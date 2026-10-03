// Electron main process entry point.
// NOTE: this file must stay CommonJS (.cjs). package.json sets
// "type": "module", so a .js main entry would be loaded as ESM and
// `require` would throw "require is not defined in ES module scope".
const { app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const DEV_URL = 'http://127.0.0.1:5173';
// RC_FORCE_PROD=1 loads the built bundle even when running unpackaged, so the
// packaged code path can be exercised against a local electron binary.
const isDev = !app.isPackaged && process.env.RC_FORCE_PROD !== '1';

// Resolve the built index.html.
//
// The built bundle must win over any same-named file at the package root: the
// project's root index.html is the Vite *template* (it has no module script,
// so loading it silently yields a blank window). In the packaged asar only
// dist/ ships, but preferring it keeps the app correct either way.
function resolveIndexHtml() {
  const candidates = [
    path.join(__dirname, 'dist', 'index.html'),
    path.join(__dirname, 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && isUsableEntry(p)) return p;
  }
  return null;
}

// A usable entry HTML must reference the JS bundle and a mount point; the
// Vite template satisfies neither and renders nothing.
function isUsableEntry(file) {
  if (!file) return false;
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return false;
  }
  if (html.length < 100) return false;
  if (!/<script[^>]+src=/i.test(html)) return false;
  if (!/id="root"/.test(html)) return false;
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#e9edf4',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[roomcraft] failed to load ${url}: ${code} ${desc}`);
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    if (process.env.RC_DEVTOOLS !== '0') win.webContents.openDevTools();
    return win;
  }

  const index = resolveIndexHtml();
  if (!index) {
    console.error('[roomcraft] no usable index.html in the package (need one with a script src and #root)');
    return win;
  }
  console.log(`[roomcraft] loading ${index}`);
  win.loadFile(index);
  return win;
}

// External links (Stripe checkout, docs) open in the real browser.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // Block in-app navigation away from the bundle.
  contents.on('will-navigate', (event, url) => {
    const local = url.startsWith('file://') || url.startsWith(DEV_URL);
    if (!local) event.preventDefault();
  });
});

// `--selftest` verifies the packaged app can boot and find its entry HTML,
// then exits. CI runs this so a broken release fails the build instead of
// shipping a window that shows an error dialog.
//
// On Windows an Electron (GUI subsystem) process has no console attached, so
// stdout from the main process is not visible to the CI shell. The result is
// therefore written to a file that the workflow reads back.
// `--screenshot <path>` opens the real window and captures it with
// Electron's own capturePage(), then exits. Lets a build pipeline prove the
// app renders real pixels: external screen-grab tools cannot be trusted here
// (PrintWindow misses GPU-composited surfaces, and Windows blocks
// SetForegroundWindow from background processes, so both capture the
// wrong window).
async function captureScreenshot(outPath) {
  const win = createWindow();
  if (win.webContents.isLoading()) {
    await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  }
  // Let React mount and the first paint settle.
  await new Promise((r) => setTimeout(r, 3500));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(outPath, img.toPNG());
  return outPath;
}

const shotArg = process.argv.indexOf('--screenshot');
if (shotArg !== -1) {
  const outPath = process.argv[shotArg + 1];
  app.whenReady().then(async () => {
    try {
      await captureScreenshot(outPath);
      console.log(`SCREENSHOT OK: ${outPath}`);
      app.exit(0);
    } catch (e) {
      console.error(`SCREENSHOT FAIL: ${e.message}`);
      app.exit(1);
    }
  });
} else if (process.argv.includes('--selftest')) {
  const fsSync = require('fs');
  const outPath = process.env.RC_SELFTEST_OUT;
  const report = (msg) => {
    if (outPath) {
      try {
        fsSync.writeFileSync(outPath, msg);
      } catch (e) {
        /* ignore */
      }
    }
    console.log(msg);
  };

  app.whenReady().then(async () => {
    const fail = (why) => {
      report(`SELFTEST FAIL: ${why}`);
      app.exit(1);
    };

    const index = resolveIndexHtml();
    if (!index) return fail('index.html not found (checked asar root and dist/)');
    if (fsSync.statSync(index).size < 100) return fail('index.html looks empty');
    if (!fsSync.existsSync(path.join(__dirname, 'preload.cjs'))) return fail('preload.cjs missing from package');

    // Actually render the page. Checking that index.html merely exists is not
    // enough: the bundle can fail to load (e.g. absolute /assets URLs, which
    // resolve to the filesystem root under file://) and leave a blank window
    // while every file check still passes.
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });

    const errors = [];
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      errors.push(`did-fail-load ${code} ${desc} ${url}`);
    });
    win.webContents.on('preload-error', (_e, p, err) => {
      errors.push(`preload-error ${p}: ${err.message}`);
    });
    win.webContents.on('console-message', (_e, level, message) => {
      // level 3 = error
      if (level === 3) errors.push(`console: ${message}`);
    });

    try {
      await win.loadFile(index);
    } catch (e) {
      return fail(`loadFile threw: ${e.message}`);
    }

    // Give the React bundle a moment to mount.
    await new Promise((r) => setTimeout(r, 2500));

    let state;
    try {
      state = await win.webContents.executeJavaScript(`(() => {
        const root = document.getElementById('root');
        const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src);
        const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href);
        return {
          ready: document.readyState,
          rootChildren: root ? root.children.length : -1,
          rootHtmlLen: root ? root.innerHTML.length : -1,
          bodyText: (document.body ? document.body.innerText : '').trim().slice(0, 120),
          scripts,
          links,
        };
      })()`);
    } catch (e) {
      return fail(`could not inspect the DOM: ${e.message}`);
    }

    const problems = [];
    if (state.rootChildren <= 0 || state.rootHtmlLen === 0) {
      problems.push('#root is empty - the bundle did not mount');
    }
    if (errors.length) problems.push(`renderer errors: ${errors.slice(0, 5).join(' | ')}`);

    // Pixel check: sample the rendered window. A blank page yields a couple of
    // colours; a real UI yields many. This catches assets that fail to load
    // under file:// even when the DOM happened to have children.
    let colours = -1;
    try {
      const img = await win.webContents.capturePage();
      const size = img.getSize();
      const bmp = img.toBitmap(); // BGRA
      const seen = new Set();
      const strideX = Math.max(1, Math.floor(size.width / 80));
      const strideY = Math.max(1, Math.floor(size.height / 80));
      for (let y = 0; y < size.height; y += strideY) {
        for (let x = 0; x < size.width; x += strideX) {
          const i = (y * size.width + x) * 4;
          seen.add((bmp[i] << 24) | (bmp[i + 1] << 16) | (bmp[i + 2] << 8) | bmp[i + 3]);
        }
      }
      colours = seen.size;
      if (colours < 20) problems.push(`window looks blank (only ${colours} distinct colours sampled)`);
    } catch (e) {
      problems.push(`capturePage failed: ${e.message}`);
    }

    if (problems.length) return fail(problems.join('; '));

    report(
      `SELFTEST OK: index=${index}; readyState=${state.ready}; ` +
        `#root children=${state.rootChildren} htmlLen=${state.rootHtmlLen}; ` +
        `sampledColours=${colours}; body="${state.bodyText.replace(/\s+/g, ' ')}"`,
    );
    app.exit(0);
  });
} else {
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}