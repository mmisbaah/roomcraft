/**
 * Pre-flight for `npm run typecheck`.
 *
 * @types/three is ~960 declaration files. A partial or truncated install still
 * *resolves*, so the failure is silent: every `three` import and every
 * React-Three-Fiber intrinsic (`<mesh>`, `<group>`, `<boxGeometry>`…) turns into
 * a missing-name error and the real errors drown in ~480 of them. This has
 * already happened once on a machine with a corrupted node_modules, and it
 * looks exactly like a code problem.
 *
 * So check the package is whole before trusting the output, and say what to do
 * if it isn't.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TYPES = resolve(process.cwd(), 'node_modules/@types/three');

/** Files that only exist in a complete install — spot-checks for truncation. */
const SIGNATURE = [
  'index.d.ts',
  'src/Three.d.ts',
  'src/Three.Core.d.ts',
  'src/objects/Group.d.ts',
  'src/math/Vector3.d.ts',
  'src/cameras/Camera.d.ts',
];
/** A complete @types/three@0.186 has around 960 files. */
const MIN_FILES = 400;

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) n += countFiles(p);
    else n++;
  }
  return n;
}

if (!existsSync(TYPES)) {
  console.error(
    '✖ @types/three is not installed, so `three` and React Three Fiber cannot be\n' +
      '  type checked at all. Run: npm install',
  );
  process.exit(1);
}

const missing = SIGNATURE.filter((f) => !existsSync(join(TYPES, f)));
const total = countFiles(TYPES);

if (missing.length) {
  console.error(
    `✖ @types/three looks incomplete — ${total} files, missing:\n` +
      missing.map((f) => `    ${f}`).join('\n') +
      '\n\n  Type errors for three/R3F will be noise until this is fixed:\n' +
      '    npm install @types/three@0.186.0 --force',
  );
  process.exit(1);
}

if (total < MIN_FILES) {
  console.error(
    `✖ @types/three has only ${total} files (expected at least ${MIN_FILES}); it is\n` +
      '  probably truncated. Reinstall it:\n' +
      '    npm install @types/three@0.186.0 --force',
  );
  process.exit(1);
}

console.log(`✔ @types/three complete (${total} files)`);