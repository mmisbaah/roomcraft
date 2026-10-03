// Direct unit test of the REAL canPlaceRaw, bundled from source (no app,
// no browser). Replicates the store's makeGrid so the door-clearance cells
// are present exactly as they are at runtime.
import { canPlaceRaw } from './src/logic/placement';
import { buildGrid, blockWall } from './src/logic/grid';
import { CLEARANCE } from './src/logic/rules';
import { ITEM_INDEX, LIBRARY } from './src/data/items';
import type { EdgeKind, PlacedItem, Vec2 } from './src/types';

const ROOM: Vec2[] = [
  { x: 0, y: 0 },
  { x: 5.6, y: 0 },
  { x: 5.6, y: 4.2 },
  { x: 2.2, y: 4.2 },
  { x: 2.2, y: 5.4 },
  { x: 0, y: 5.4 },
];
const OPENINGS: EdgeKind[] = ['window', 'wall', 'wall', 'door', 'wall', 'wall'];

// Same construction as store.ts makeGrid.
const grid = buildGrid(ROOM);
for (let i = 0; i < ROOM.length; i++) {
  if ((OPENINGS[i] ?? 'wall') === 'door') {
    blockWall(grid, ROOM[i], ROOM[(i + 1) % ROOM.length], CLEARANCE.doorApproach);
  }
}

function place(itemId: string, x: number, y: number, rot = 0): PlacedItem {
  return { uid: `${itemId}-${x}-${y}`, itemId, x, y, rot, colorIdx: 0 };
}

let failures = 0;

/** `expect=true` asserts the move is allowed; `expect=false` asserts refused. */
function check(
  label: string,
  itemId: string,
  x: number,
  y: number,
  items: PlacedItem[],
  expect: boolean,
  rot = 0,
) {
  const item = ITEM_INDEX.get(itemId)!;
  const uid = items.find((i) => Math.abs(i.x - x) < 1e-9 && Math.abs(i.y - y) < 1e-9)?.uid;
  const got = canPlaceRaw(grid, ROOM, items, ITEM_INDEX, item, x, y, rot, uid);
  const ok = got === expect;
  if (!ok) failures++;
  console.log(
    `  ${ok ? 'ok  ' : 'BAD '} ${label} -> canPlaceRaw=${got} (expected ${expect})`,
  );
}

console.log('Allowed moves (same position / free space):');
check('chair at 1.0,2.0', 'seating-2', 1.0, 2.0, [place('seating-2', 1.0, 2.0)], true);
check('chair at 5.25,1.25', 'seating-2', 5.25, 1.25, [place('seating-2', 5.25, 1.25)], true);
check('sofa at 2.25,0.5', 'seating-0', 2.25, 0.5, [place('seating-0', 2.25, 0.5)], true);
check('table 1.0,1.0', 'tables-0', 1.0, 1.0, [place('tables-0', 1.0, 1.0)], true);

console.log('\nRefused moves (walls and collisions must still block):');
const chairA = place('seating-2', 1.0, 2.0);
const chairB = place('seating-2', 1.15, 2.0);
check('chair overlapping another chair', 'seating-2', 1.15, 2.0, [chairA, chairB], false);
check('chair outside the room (x=-1)', 'seating-2', -1.0, 2.0, [place('seating-2', -1.0, 2.0)], false);
check('sofa outside the room (y=-1)', 'seating-0', 2.25, -1.0, [place('seating-0', 2.25, -1.0)], false);
check('sofa outside the room (x=9)', 'seating-0', 9.0, 2.0, [place('seating-0', 9.0, 2.0)], false);
check('sofa in the L-shaped notch', 'seating-0', 3.5, 4.8, [place('seating-0', 3.5, 4.8)], false);

console.log('\nRotation must be honoured (guards the NaN regression):');
for (const rot of [0, 90, 180, 270]) {
  const items = [place('seating-0', 1.5, 1.5)];
  check(`sofa at 1.5,1.5 rot=${rot}`, 'seating-0', 1.5, 1.5, items, true, rot);
}

console.log(`\nLibrary: ${LIBRARY.length} items, ITEM_INDEX ${ITEM_INDEX.size}`);
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);