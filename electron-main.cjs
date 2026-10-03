// Electron main process entry point.
// NOTE: this file must stay CommonJS (.cjs). package.json sets
// "type": "module", so a .js main entry would be loaded as ESM and
// `require` would throw "require is not defined in ES module scope".
const { app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const DEV_URL = 'http://127.0.0.1:5173';
const isDev = !app.isPackaged;

// Resolve the built index.html. electron-builder's file globs can place the
// built app either at the asar root or under dist/ depending on the pattern,
// so probe both instead of hard-coding one.
function resolveIndexHtml() {
  const candidates = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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
    console.error('[roomcraft] could not find index.html in the package');
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
if (process.argv.includes('--selftest')) {
  const fsSync = require('fs');
  const outPath = process.env.RC_SELFTEST_OUT;
  const write = (msg) => {
    if (outPath) {
      try {
        fsSync.writeFileSync(outPath, msg);
      } catch (e) {
        /* ignore */
      }
    }
    console.log(msg);
  };

  app.whenReady().then(() => {
    const index = resolveIndexHtml();
    let problem = null;
    if (!index) problem = 'index.html not found (checked asar root and dist/)';
    else if (fsSync.statSync(index).size < 100) problem = `index.html is only ${fsSync.statSync(index).size} bytes`;
    else if (!fsSync.existsSync(path.join(__dirname, 'preload.cjs'))) problem = 'preload.cjs missing from package';

    if (problem) {
      write(`SELFTEST FAIL: ${problem}`);
      app.exit(1);
      return;
    }
    write(`SELFTEST OK: resolved ${index} (${fsSync.statSync(index).size} bytes); preload.cjs present`);
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