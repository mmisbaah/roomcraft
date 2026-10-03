/**
 * Every AI Fill preset must resolve to real library items.
 *
 * A step naming a type, or a type+kind pair, that does not exist in the
 * library silently falls back to the rest of the category (or to nothing), so
 * a typo here shows up as a room quietly missing a piece of furniture rather
 * than as an error. This checks the whole spec up front instead.
 */
import { PRESETS, ROOM_KIND_ORDER, withCeilingLight } from './src/logic/placement';
import { LIBRARY } from './src/data/items';
import type { FurnType, RoomKind } from './src/types';

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

// Index the library by type and by type+kind.
const byType = new Map<string, number>();
const byKind = new Map<string, number>();
for (const f of LIBRARY) {
  byType.set(f.type, (byType.get(f.type) ?? 0) + 1);
  const key = `${f.type}:${f.kind}`;
  byKind.set(key, (byKind.get(key) ?? 0) + 1);
}

console.log('Every preset step names a category that exists:');
{
  const missing: string[] = [];
  let total = 0;
  for (const kind of ROOM_KIND_ORDER) {
    for (const s of PRESETS[kind] ?? []) {
      total++;
      if (!byType.has(s.type)) missing.push(`${kind} -> ${s.type}`);
    }
  }
  ok(`all ${total} steps use real categories`, missing.length === 0, missing.join(' | '));
}

console.log('\nEvery named kind exists within its category:');
{
  const missing: string[] = [];
  let named = 0;
  for (const kind of ROOM_KIND_ORDER) {
    for (const s of PRESETS[kind] ?? []) {
      if (!s.kind) continue;
      named++;
      const key = `${s.type}:${s.kind}`;
      if (!byKind.has(key)) missing.push(`${kind} -> ${key}`);
    }
  }
  ok(`all ${named} named kinds exist`, missing.length === 0, missing.join(' | '));
}

console.log('\nEvery room gets a ceiling light:');
{
  const missing = ROOM_KIND_ORDER.filter((k) => {
    const steps = withCeilingLight(PRESETS[k] ?? []);
    return !steps.some((s) => s.type === 'ceilight');
  });
  ok('all rooms place at least one ceiling light', missing.length === 0, missing.join(', '));
}

console.log('\nAn explicit ceiling light is never doubled up:');
{
  const dining = withCeilingLight(PRESETS.dining);
  const chandeliers = dining.filter((s) => s.type === 'ceilight' && s.kind === 'chandelier').length;
  const totalCeiling = dining.filter((s) => s.type === 'ceilight').length;
  ok('dining keeps its chandelier and gains nothing extra', chandeliers === 1 && totalCeiling === 1,
    `chandeliers=${chandeliers} ceiling steps=${totalCeiling}`);

  // Under-shelf strip lighting is not a room light, so a pantry that only lists
  // strips correctly gains a flush fitting.
  const pantry = withCeilingLight(PRESETS.pantry);
  const pantryCeiling = pantry.filter((s) => s.type === 'ceilight');
  ok('pantry gains exactly one ceiling fitting', pantryCeiling.length === 1,
    JSON.stringify(pantryCeiling));

  // A room with none in its list gets exactly one.
  const bare: FurnType[] = [];
  const added = withCeilingLight([{ type: 'seating', kind: 'sofa' }]);
  ok('a room without one gets exactly one added',
    added.filter((s) => s.type === 'ceilight').length === 1, `added=${added.length - 1}`);
  void bare;
  // Architectural strip lighting is not a room light, so a pantry that only has
  // under-shelf strips still gets a ceiling fitting.
  const stripOnly = withCeilingLight([
    { type: 'archlight', kind: 'ledstrip' },
    { type: 'storage', kind: 'shelving' },
  ]);
  ok('strip lighting alone does not count as a ceiling light',
    stripOnly.some((s) => s.type === 'ceilight'), JSON.stringify(stripOnly));
}

console.log('\nEvery room lists both furniture and design objects:');
{
  // A preset of only one category reads as a half-furnished room.
  const FURNITURE: FurnType[] = ['seating', 'tables', 'storage', 'beds', 'kitchen', 'dining',
    'vanity', 'bathtub', 'shower', 'toilet'];
  const tooThin = ROOM_KIND_ORDER.filter((k) => {
    const steps = withCeilingLight(PRESETS[k] ?? []);
    const hasFurniture = steps.some((s) => FURNITURE.includes(s.type));
    const total = steps.reduce((n, s) => n + (s.count ?? 1), 0);
    return !hasFurniture || total < 6;
  });
  ok('every room has real furniture and enough of it', tooThin.length === 0, tooThin.join(', '));
}

console.log('\nRoom lists are substantive:');
{
  const sizes = ROOM_KIND_ORDER.map((k: RoomKind) => {
    const steps = withCeilingLight(PRESETS[k] ?? []);
    return { k, n: steps.reduce((a, s) => a + (s.count ?? 1), 0) };
  });
  const smallest = sizes.slice().sort((a, b) => a.n - b.n).slice(0, 3);
  console.log('  smallest: ' + smallest.map((s) => `${s.k}=${s.n}`).join(', '));
  ok('every room asks for at least 10 objects', smallest.every((s) => s.n >= 10),
    smallest.map((s) => `${s.k}=${s.n}`).join(', '));
  ok('no room asks for more than 45 objects', sizes.every((s) => s.n <= 45),
    Math.max(...sizes.map((s) => s.n)).toString());
}

console.log('\nHallways and closets stay walkable:');
{
  // A corridor must not be filled like a living room.
  for (const k of ['hallway', 'entryway', 'closet'] as RoomKind[]) {
    const n = (PRESETS[k] ?? []).reduce((a, s) => a + (s.count ?? 1), 0);
    ok(`${k} stays restrained`, n <= 16, `${n} steps`);
  }
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);