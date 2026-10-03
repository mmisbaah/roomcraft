// Verify the Electron main process parses as CommonJS under "type": "module",
// which is exactly what broke the published build (ReferenceError: require is
// not defined in ES module scope).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

let ok = true;
const check = (label, pass, extra = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
  if (!pass) ok = false;
};

// 1. main entry must be a .cjs file (CJS) since type=module
check('type is module', pkg.type === 'module');
check('main points to a .cjs file', pkg.main.endsWith('.cjs'), pkg.main);
check('main file exists', fs.existsSync(path.join(root, pkg.main)));

// 2. Both electron files must parse as CommonJS (require/electron available)
for (const f of ['electron-main.cjs', 'preload.cjs']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) {
    check(`${f} exists`, false);
    continue;
  }
  const src = fs.readFileSync(p, 'utf8');
  try {
    // Wrapping in a CJS function scope: mirrors how Node loads a .cjs file.
    new vm.Script(`(function (exports, require, module, __filename, __dirname) {\n${src}\n})`, {
      filename: f,
    });
    check(`${f} parses as CommonJS`, true);
  } catch (e) {
    check(`${f} parses as CommonJS`, false, e.message);
  }
}

// 3. preload path referenced in main must point at the .cjs file
const mainSrc = fs.readFileSync(path.join(root, pkg.main), 'utf8');
check('main references preload.cjs', mainSrc.includes('preload.cjs'));
check('main has no stale preload.js ref', !mainSrc.includes("preload.js'"));

// 4. build.files must include the .cjs files (asar packaging)
const files = pkg.build?.files ?? [];
check('build.files includes electron-main.cjs', files.includes('electron-main.cjs'));
check('build.files includes preload.cjs', files.includes('preload.cjs'));
check('build.files excludes stale .js', !files.some((f) => /^electron-main\.js$|^preload\.js$/.test(f)));

// 5. web build output present for loadFile()
check('dist/index.html exists', fs.existsSync(path.join(root, 'dist', 'index.html')));

// 6. icon is a real PNG (magic bytes), not an SVG renamed to .ico
const iconPath = path.join(root, 'assets', 'icon.png');
if (fs.existsSync(iconPath)) {
  const buf = fs.readFileSync(iconPath);
  check('icon.png is a PNG', buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47);
} else {
  check('icon.png exists', false);
}

console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);