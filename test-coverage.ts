/**
 * Does the coverage floor actually bind, and where does it not?
 *
 * The fill works towards a share of the floor. Some rooms cannot reach it —
 * a corridor or a pantry should stay sparse whatever the target says — so this
 * reports which, rather than asserting a number that is quietly unreachable.
 */
import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { ROOM_KIND_ORDER, isFlat, coverageBudget, COVERAGE_FLOOR } from './src/logic/placement';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));

/**
 * No exemptions. An earlier version held corridors and pantries back from the
 * target, on the reasoning that a hallway is not a lounge — but every room
 * reaches the floor anyway now, and keeping the exemption would only hide a
 * future room that stops being filled.
 */

const SIZES: [string, number, number][] = [
  ['small', 3.2, 3.0],
  ['medium', 5.0, 4.5],
  ['large', 8.0, 6.0],
  ['xlarge', 12, 10],
];

function fill(kind: RoomKind, w: number, h: number) {
  S().clearRoom();
  S().askRoom(null);
  S().setMode('draw');
  S().setTier('max');
  S().addRoom([
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]);
  const room = S().rooms[0];
  S().describeRoom(room.id, { name: '', kind, note: '' });
  S().clearItems();
  S().aiFill();
  const mine = S().items.filter((i) => i.roomId === room.id);
  const area = w * h;
  let hard = 0;
  let pieces = 0;
  for (const it of mine) {
    const f = BY.get(it.itemId);
    if (!f || f.mount !== 'floor' || isFlat(f)) continue;
    hard += f.w * f.d;
    pieces++;
  }
  return { area, pct: (hard / area) * 100, items: mine.length, pieces };
}

let failures = 0;
let checks = 0;
function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log(`Coverage floor: ${COVERAGE_FLOOR * 100}% of floor area\n`);
// Tolerance, not fudge: the top-up drops any candidate that will not fit rather
// than nudging it, so a room can legitimately stop a little short of the share
// it was aiming at. A point and a half is well inside the gap that produces —
// the transition sits between 8.8% and 11% — while still failing a room that has
// genuinely stopped being filled.
const TOLERANCE = 1.5;
const short: string[] = [];
for (const [label, w, h] of SIZES) {
  console.log(`${label} ${w}x${h} (${(w * h).toFixed(1)} m2)`);
  const rows: string[] = [];
  for (const kind of ROOM_KIND_ORDER) {
    let pct = 0;
    let items = 0;
    for (let r = 0; r < 3; r++) {
      const f = fill(kind, w, h);
      pct += f.pct;
      items += f.items;
    }
    pct /= 3;
    items = Math.round(items / 3);
    const shortBy = pct < COVERAGE_FLOOR * 100 - TOLERANCE;
    if (shortBy) short.push(`${label}/${kind} ${pct.toFixed(1)}%`);
    rows.push(
      `  ${shortBy ? '!' : ' '} ${kind.padEnd(9)} ${items.toString().padStart(3)} items  ${pct.toFixed(1).padStart(5)}%`,
    );
  }
  rows.forEach((r) => console.log(r));
}

console.log('\nThe ceiling still holds everywhere:');
{
  let over = 0;
  const bad: string[] = [];
  for (const [label, w, h] of SIZES) {
    for (const kind of ROOM_KIND_ORDER) {
      const f = fill(kind, w, h);
      const cap = coverageBudget(f.area) * 100 + 0.5;
      if (f.pct > cap) {
        over++;
        bad.push(`${label}/${kind} ${f.pct.toFixed(1)}% > ${cap.toFixed(1)}%`);
      }
    }
  }
  ok('no room goes over its coverage ceiling', over === 0, bad.join(' | '));
}

console.log('\nThe floor is reached where it should be:');
{
  ok(
    `every room reaches the coverage floor (within ${TOLERANCE} point)`,
    short.length === 0,
    short.join(' | '),
  );
}

S().setWallBuild(false);
S().clearRoom();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);