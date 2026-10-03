/**
 * Walls that close a loop become rooms.
 *
 * The 🧱 tool draws walls, and a user does not think in walls — they trace the
 * three sides that are missing and expect the fourth, which already belongs to
 * the room next door, to finish the job. So "enclosed" is the thing that makes
 * a room, not "the last click landed back on the first".
 *
 * These checks drive the real store, because the interesting part is not the
 * geometry (test-enclose covers that) but the bookkeeping around it: which
 * walls get absorbed, which are left alone, and what the new room starts as.
 */
import './test-dom-stub';
import { useStore } from './src/store';
import type { RoomKind, Vec2 } from './src/types';

function polygonArea(poly: Vec2[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(s) / 2;
}

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

const S = () => useStore.getState();

function fresh() {
  S().clearRoom();
  S().setWallBuild(true);
  S().setWallSnap('align');
}
function lay(...pts: [number, number][]) {
  for (const [x, y] of pts) S().addWallPoint({ x, y });
}

console.log('Tracing a square that closes against itself becomes a room:');
{
  fresh();
  // Four corners, finished with Esc rather than a click back on the start —
  // the four walls are laid, and they enclose a room.
  lay([0, 0], [5, 0], [5, 4], [0, 4]);
  S().addWallPoint({ x: 0, y: 0 }); // close the loop
  S().finishWallDraft();
  ok('a room was made', S().rooms.length === 1, `${S().rooms.length} rooms`);
  ok('and the walls were absorbed into it', S().walls.length === 0, `${S().walls.length} left`);
  ok('it is about 20 m²', Math.abs(polygonArea(S().rooms[0].poly) - 20) < 0.2,
    `${polygonArea(S().rooms[0].poly).toFixed(2)}`);
  ok('it starts as a living room', S().rooms[0]?.kind === 'living', `${S().rooms[0]?.kind}`);
  ok('with a name field waiting', S().rooms[0]?.name === '');
  ok('and openings suggested', (S().rooms[0]?.openings.length ?? 0) === S().rooms[0]?.poly.length,
    `${S().rooms[0]?.openings.length} edges`);
  ok('the type prompt is raised', S().pendingRoomId === S().rooms[0]?.id);
}

console.log('\nThe screenshot case: three sides drawn, the fourth is the neighbour:');
{
  fresh();
  // A room already on the plan, occupying x 4..8.
  S().addRoom([
    { x: 4, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 4 },
    { x: 4, y: 4 },
  ]);
  S().setMode('draw');
  S().setWallBuild(true);
  ok('the neighbour exists', S().rooms.length === 1, `${S().rooms.length}`);

  // Now trace the room to its left. Its right-hand edge is the neighbour's left
  // edge, which the user never draws — so only three walls are laid and the
  // fourth has to come from the room next door.
  S().addWallPoint({ x: 4, y: 0 });
  S().addWallPoint({ x: 0, y: 0 });
  S().addWallPoint({ x: 0, y: 4 });
  S().addWallPoint({ x: 4, y: 4 });
  S().finishWallDraft();

  ok('the new enclosure became a second room', S().rooms.length === 2, `${S().rooms.length} rooms`);
  const made = S().rooms.find((r) => r.id !== S().rooms[0].id) ?? S().rooms[1];
  ok('it is the left-hand one', made ? made.poly.every((p) => p.x <= 4.001) : false,
    made ? JSON.stringify(made.poly) : '');
  ok('about 16 m²', made ? Math.abs(polygonArea(made.poly) - 16) < 0.2 : false,
    made ? polygonArea(made.poly).toFixed(2) : '');
  ok('its three walls were absorbed', S().walls.length === 0, `${S().walls.length} left`);
  ok('the neighbour was not disturbed', S().rooms[0].poly.length === 4);
}

console.log('\nAn open partition stays a partition:');
{
  fresh();
  lay([0, 0], [0, 4], [4, 4]);
  S().finishWallDraft();
  ok('no room', S().rooms.length === 0, `${S().rooms.length}`);
  ok('both walls kept', S().walls.length === 2, `${S().walls.length}`);
}

console.log('\nA loop too small to be a room keeps its walls:');
{
  fresh();
  // Free snapping, so the loop is exactly the size asked for: 1.5 x 1.5 is
  // below the 4 m² a room has to be, and must be kept as walls rather than
  // becoming a closet the size of a phone box.
  S().setWallSnap('free');
  lay([0, 0], [1.5, 0], [1.5, 1.5], [0, 1.5]);
  S().addWallPoint({ x: 0, y: 0 });
  S().finishWallDraft();
  ok('no room', S().rooms.length === 0, `${S().rooms.length}`);
  ok('all four walls kept', S().walls.length === 4, `${S().walls.length}`);
}

console.log('\nA loop inside an existing room does not become a second room:');
{
  fresh();
  S().addRoom([
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 6 },
    { x: 0, y: 6 },
  ]);
  S().setMode('draw');
  S().setWallBuild(true);
  lay([2, 2], [5, 2], [5, 4], [2, 4], [2, 2]);
  S().finishWallDraft();
  ok('still one room', S().rooms.length === 1, `${S().rooms.length}`);
  ok('the inner walls are kept as partitions', S().walls.length === 4, `${S().walls.length}`);
}

console.log('\nTwo rooms sharing a wall:');
{
  fresh();
  // Left room traced fully.
  lay([0, 0], [4, 0], [4, 3], [0, 3], [0, 0]);
  S().finishWallDraft();
  ok('first room', S().rooms.length === 1, `${S().rooms.length}`);
  ok('its walls absorbed', S().walls.length === 0, `${S().walls.length}`);

  // Right room: its left edge is the first room's right edge, so only three
  // walls are drawn here too.
  S().setWallBuild(true);
  lay([4, 3], [7, 3], [7, 0], [4, 0]);
  S().finishWallDraft();
  ok('second room made', S().rooms.length === 2, `${S().rooms.length}`);
  ok('only the two new walls were absorbed', S().walls.length === 0, `${S().walls.length} left`);
  const areas = S().rooms.map((r) => polygonArea(r.poly)).sort((a, b) => a - b);
  ok('with the right areas', Math.abs(areas[0] - 9) < 0.2 && Math.abs(areas[1] - 12) < 0.2,
    areas.map((a) => a.toFixed(2)).join(', '));
  ok('and both outlines are intact quads',
    S().rooms.every((r) => r.poly.length === 4),
    S().rooms.map((r) => r.poly.length).join(','));
}

console.log('\nA leftover loop elsewhere is left alone:');
{
  fresh();
  // A small enclosed loop that is too small to be a room, so it stays walls.
  S().setWallSnap('free');
  lay([0, 0], [1.5, 0], [1.5, 1.5], [0, 1.5], [0, 0]);
  S().finishWallDraft();
  ok('the stub loop is walls', S().walls.length === 4 && S().rooms.length === 0,
    `${S().walls.length} walls, ${S().rooms.length} rooms`);

  // Now draw something far away. The stub must not be promoted.
  S().setWallBuild(true);
  lay([20, 20], [20, 24], [26, 24]);
  S().finishWallDraft();
  ok('still no room from the stub', S().rooms.length === 0, `${S().rooms.length}`);
  ok('and its walls survived', S().walls.length >= 4, `${S().walls.length}`);
}

console.log('\nThe new room can be typed straight away:');
{
  fresh();
  lay([0, 0], [5, 0], [5, 4], [0, 4], [0, 0]);
  S().finishWallDraft();
  const room = S().rooms[0];
  S().describeRoom(room.id, { name: 'Galley', kind: 'kitchen' as RoomKind, note: 'needs a big table' });
  ok('the type stuck', S().rooms[0].kind === 'kitchen', `${S().rooms[0].kind}`);
  ok('the name stuck', S().rooms[0].name === 'Galley', `${S().rooms[0].name}`);
  ok('the description stuck', S().rooms[0].note === 'needs a big table');
  ok('and the prompt cleared', S().pendingRoomId === null, `${S().pendingRoomId}`);
}

console.log('\nFinishing nothing is harmless:');
{
  fresh();
  S().finishWallDraft();
  ok('no rooms, no walls', S().rooms.length === 0 && S().walls.length === 0);
}

S().setWallBuild(false);
S().clearRoom();

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);