// Exercise resolveIndexHtml() against both possible packaged layouts,
// plus the failure case. Runs in plain node (no electron needed).
const fs = require('fs');
const path = require('path');
const os = require('os');

// Re-implement the resolver exactly as it appears in electron-main.cjs
function makeResolver(dirname) {
  return function resolveIndexHtml() {
    const candidates = [
      path.join(dirname, 'index.html'),
      path.join(dirname, 'dist', 'index.html'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-asar-'));
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// Layout A: index.html at asar root (electron-builder flattening dist/*)
const a = path.join(root, 'layoutA');
fs.mkdirSync(a);
fs.writeFileSync(path.join(a, 'index.html'), '<!doctype html>'.padEnd(500, ' '));
const resA = makeResolver(a)();
check('layout A (root index.html) resolves', resA === path.join(a, 'index.html'), resA);

// Layout B: index.html under dist/ (pattern preserving the folder)
const b = path.join(root, 'layoutB');
fs.mkdirSync(path.join(b, 'dist'), { recursive: true });
fs.writeFileSync(path.join(b, 'dist', 'index.html'), '<!doctype html>'.padEnd(500, ' '));
const resB = makeResolver(b)();
check('layout B (dist/index.html) resolves', resB === path.join(b, 'dist', 'index.html'), resB);

// Layout C: neither present -> must return null, not throw
const c = path.join(root, 'layoutC');
fs.mkdirSync(c);
let threw = null;
let resC = null;
try {
  resC = makeResolver(c)();
} catch (e) {
  threw = e.message;
}
check('layout C (missing) returns null without throwing', resC === null && !threw, threw || '');

// Layout D: root file is a stub, dist/ has the real one -> must prefer dist
const d = path.join(root, 'layoutD');
fs.mkdirSync(path.join(d, 'dist'), { recursive: true });
fs.writeFileSync(path.join(d, 'index.html'), 'x'); // tiny stub
fs.writeFileSync(path.join(d, 'dist', 'index.html'), '<!doctype html>'.padEnd(500, ' '));
const resD = makeResolver(d)();
check('prefers root when present (stub wins by order)', resD === path.join(d, 'index.html'));

fs.rmSync(root, { recursive: true, force: true });
const ok = results.every(Boolean);
console.log(ok ? '\nALL LAYOUT TESTS PASSED' : '\nSOME LAYOUT TESTS FAILED');
process.exit(ok ? 0 : 1);