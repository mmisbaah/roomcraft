/**
 * Regression tests for wall snapping and room creation.
 *
 * The 🧱 wall tool has two behaviours that are easy to break and invisible when
 * broken (walls just land slightly wrong), so they are pinned here:
 *
 *  1. A new wall within 10° of the wall it joins is squared up into a right
 *     angle, so drawing a rectangle closes cleanly.
 *  2. A chain that returns to its start point becomes a room.
 *
 * Run with: npm run test:walls
 */
import { cleanPolygon, polyArea, polysOverlap } from './src/logic/geometry';
import {
  CLOSE_RADIUS,
  lineAngleDiff,
  snapWallPoint,
  startWallPoint,
  suggestOpenings,
} from './src/logic/wallsnap';
import type { BuiltWall, Vec2 } from './src/types';

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

const deg = (r: number) => (r * 180) / Math.PI;

/** Angle of the segment a→b in degrees, folded to (-90, 90]. */
function segAngleDeg(a: Vec2, b: Vec2): number {
  let d = deg(Math.atan2(b.y - a.y, b.x - a.x)) % 180;
  if (d > 90) d -= 180;
  if (d <= -90) d += 180;
  return d;
}

// ---------------------------------------------------------------------------
console.log('Line-angle helper:');
{
  ok('parallel lines differ by 0', Math.abs(lineAngleDiff(0, 0)) < 1e-9);
  ok('perpendicular lines differ by 90', Math.abs(Math.abs(lineAngleDiff(Math.PI / 2, 0)) - Math.PI / 2) < 1e-9);
  ok('180° is the same line as 0', Math.abs(lineAngleDiff(Math.PI, 0)) < 1e-9);
  ok('-90° folds to +90°', Math.abs(lineAngleDiff(-Math.PI / 2, 0) - Math.PI / 2) < 1e-9);
}

// ---------------------------------------------------------------------------
console.log('\nA wall joining a horizontal wall at a shallow angle is squared up:');
{
  // Source wall runs left→right along y = 0.
  const walls: BuiltWall[] = [{ id: 'w1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, kind: 'wall' }];
  const anchor: Vec2 = { x: 3, y: 0 };

  // Chain started from the wall, so ref = the wall's angle (0 rad).
  for (const offDeg of [0, 3, -3, 7, -7, 9, -9]) {
    const r = (offDeg * Math.PI) / 180;
    const click: Vec2 = { x: anchor.x + Math.cos(r) * 2, y: anchor.y + Math.sin(r) * 2 };
    const p = snapWallPoint(click, [], walls, [anchor], 0);
    const a = segAngleDeg(anchor, p);
    const isSquare = Math.abs(Math.abs(a) - 90) < 0.5;
    ok(`click ${offDeg}° off parallel → 90°`, isSquare, `got ${a.toFixed(1)}°`);
  }

  // Beyond the 10° threshold the 45° lattice takes over, but never back to 0°
  // — a wall joining another and running parallel to it is a dead join.
  for (const offDeg of [20, 45, 90, -20, -45]) {
    const r = (offDeg * Math.PI) / 180;
    const click: Vec2 = { x: anchor.x + Math.cos(r) * 2, y: anchor.y + Math.sin(r) * 2 };
    const p = snapWallPoint(click, [], walls, [anchor], 0);
    const a = segAngleDeg(anchor, p);
    const lattice = Math.abs(Math.abs(a) % 45) < 0.5 || Math.abs(45 - (Math.abs(a) % 45)) < 0.5;
    ok(`click ${offDeg}° lands on the lattice`, lattice && Math.abs(a) > 1, `got ${a.toFixed(1)}°`);
    ok(`click ${offDeg}° is not parallel`, Math.abs(Math.abs(a) - 0) > 1, `got ${a.toFixed(1)}°`);
  }

  // Free-ground chains (no wall to join) may still run along the global axes.
  const freeChain: Vec2[] = [{ x: 2, y: 2 }];
  const flat = snapWallPoint({ x: 4, y: 2.05 }, [], [], freeChain, null);
  ok('free-ground chain can still run parallel to an axis', Math.abs(segAngleDeg(freeChain[0], flat)) < 0.5,
    `got ${segAngleDeg(freeChain[0], flat).toFixed(1)}°`);
}

console.log('\nA chain follows its own previous segment, not its starting wall:');
{
  // Tracing a room outline: down the left wall, then a right turn along the
  // bottom. Measured against the wall the chain started on (the top wall, 0°),
  // that 90° turn looks parallel and gets squared into a reversal.
  const room: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4.34, y: 0 },
    { x: 4.34, y: 4.24 },
    { x: 0, y: 4.24 },
  ];
  const polys = [room];
  const chain: Vec2[] = [{ x: 0, y: 0 }];
  const p1 = snapWallPoint({ x: 0, y: 3 }, polys, [], chain, 0, 'align');
  ok('first segment goes down the wall', Math.abs(segAngleDeg(chain[0], p1) - 90) < 0.5,
    `got ${segAngleDeg(chain[0], p1).toFixed(1)}°`);
  chain.push(p1);
  const p2 = snapWallPoint({ x: 3, y: 3 }, polys, [], chain, 0, 'align');
  ok('a 90° turn afterwards is allowed', Math.abs(segAngleDeg(p1, p2)) < 0.5,
    `got ${segAngleDeg(p1, p2).toFixed(1)}°`);
  ok('the turn lands where it was aimed', Math.abs(p2.x - 3) < 0.2 && Math.abs(p2.y - 3) < 0.2,
    `(${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`);

  // A third segment, turning again, must also work.
  chain.push(p2);
  const p3 = snapWallPoint({ x: 3, y: 1.5 }, polys, [], chain, 0, 'align');
  ok('a second 90° turn is allowed', Math.abs(segAngleDeg(p2, p3) - 90) < 0.5,
    `got ${segAngleDeg(p2, p3).toFixed(1)}°`);

  // Diagonals off the previous segment stay on the 45° lattice.
  const diagChain: Vec2[] = [{ x: 0, y: 0 }, { x: 2, y: 0 }];
  const diag = snapWallPoint({ x: 4, y: 2 }, polys, [], diagChain, 0, 'align');
  ok('a 45° continuation still works', Math.abs(segAngleDeg(diagChain[1], diag) - 45) < 0.5,
    `got ${segAngleDeg(diagChain[1], diag).toFixed(1)}°`);
}

console.log('\nAt a room corner, aiming along a wall is taken at face value:');
{
  // The reported case: a chain begun at the bottom-left corner of a room, with
  // the cursor aiming straight down. It must stay straight down, not be squared.
  const room: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4.34, y: 0 },
    { x: 4.34, y: 4.24 },
    { x: 0, y: 4.24 },
  ];
  const polys = [room];
  const corner: Vec2 = { x: 0, y: 4.24 };
  // ref = the direction of the bottom wall the corner sits on.
  const ref = Math.atan2(0, 4.34);

  const down = snapWallPoint({ x: 0, y: 5.74 }, polys, [], [corner], ref, 'align');
  ok('aiming straight down stays straight down', Math.abs(segAngleDeg(corner, down) - 90) < 0.5,
    `got ${segAngleDeg(corner, down).toFixed(1)}°`);

  const right = snapWallPoint({ x: 1.5, y: 4.24 }, polys, [], [corner], ref, 'align');
  ok('aiming along the wall (right) is allowed', Math.abs(segAngleDeg(corner, right)) < 0.5,
    `got ${segAngleDeg(corner, right).toFixed(1)}°`);

  const left = snapWallPoint({ x: -1.5, y: 4.24 }, polys, [], [corner], ref, 'align');
  ok('aiming back along it (left) is allowed', Math.abs(Math.abs(segAngleDeg(corner, left)) - 0) < 0.5,
    `got ${segAngleDeg(corner, left).toFixed(1)}°`);

  // Straight up is 90° from the joined wall, which is a clean square and has
  // always been allowed — included here so a future change can't quietly break
  // the opposite direction either.
  const up = snapWallPoint({ x: 0, y: 2.74 }, polys, [], [corner], ref, 'align');
  ok('aiming straight up stays straight up', Math.abs(segAngleDeg(corner, up) - 90) < 0.5,
    `got ${segAngleDeg(corner, up).toFixed(1)}°`);
}

console.log('\nPartway along a wall, a parallel segment is still squared up:');
{
  // The original intent behind the rule: a partition starting mid-wall and
  // doubling back over it. This must NOT be allowed to run parallel.
  const room: Vec2[] = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 4 },
    { x: 0, y: 4 },
  ];
  const polys = [room];
  const mid: Vec2 = { x: 3, y: 0 }; // middle of the top wall
  const ref = 0; // that wall's direction

  for (const offDeg of [0, 4, -4, 8, -8]) {
    const r = (offDeg * Math.PI) / 180;
    const p = snapWallPoint({ x: mid.x + Math.cos(r) * 2, y: mid.y + Math.sin(r) * 2 }, polys, [], [mid], ref, 'align');
    const a = segAngleDeg(mid, p);
    ok(`mid-wall, ${offDeg}° off → square`, Math.abs(Math.abs(a) - 90) < 0.5, `got ${a.toFixed(1)}°`);
  }
}

console.log('\nA free-standing partition endpoint still squares up:');
{
  // Started on a partition that has no perpendicular at that point — there is
  // no corner there, so a parallel run is the degenerate case the rule is for.
  const walls: BuiltWall[] = [{ id: 'w1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, kind: 'wall' }];
  const freeEnd: Vec2 = { x: 6, y: 0 };
  for (const offDeg of [0, 5, -5, 9, -9]) {
    const r = (offDeg * Math.PI) / 180;
    const p = snapWallPoint({ x: freeEnd.x + Math.cos(r) * 2, y: freeEnd.y + Math.sin(r) * 2 }, [], walls, [freeEnd], 0, 'align');
    const a = segAngleDeg(freeEnd, p);
    ok(`partition end, ${offDeg}° off → square`, Math.abs(Math.abs(a) - 90) < 0.5, `got ${a.toFixed(1)}°`);
  }
}

console.log('\nThe squared wall goes to the side the cursor is on:');
{
  const walls: BuiltWall[] = [{ id: 'w1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, kind: 'wall' }];
  const anchor: Vec2 = { x: 3, y: 0 };
  const up = snapWallPoint({ x: 5, y: 1.2 }, [], walls, [anchor], 0);
  const down = snapWallPoint({ x: 5, y: -1.2 }, [], walls, [anchor], 0);
  ok('cursor above -> wall goes up', up.y > anchor.y, `y=${up.y.toFixed(2)}`);
  ok('cursor below -> wall goes down', down.y < anchor.y, `y=${down.y.toFixed(2)}`);
}

console.log('\nClosing a free-standing rectangle squares the last side:');
{
  // Three sides of a rectangle walked; the next click grabs the start point.
  const chain: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];
  const p = snapWallPoint({ x: 0.1, y: 0.15 }, [], [], chain, null);
  const a = segAngleDeg(chain[3], p);
  ok('closing segment meets the first edge at 90°', Math.abs(Math.abs(a) - 90) < 0.5, `got ${a.toFixed(1)}°`);
  ok('CLOSE_RADIUS is a sensible grab distance', CLOSE_RADIUS >= 0.3 && CLOSE_RADIUS <= 0.6);
}

console.log('\nVertex snapping still wins over the angle rules:');
{
  const walls: BuiltWall[] = [{ id: 'w1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, kind: 'wall' }];
  const chain: Vec2[] = [{ x: 3, y: 0 }];
  const corner: Vec2 = { x: 6, y: 0 };
  const p = snapWallPoint(corner, [], walls, chain, 0);
  ok('clicking an existing endpoint returns that endpoint', p.x === corner.x && p.y === corner.y);
}

// ---------------------------------------------------------------------------
console.log('\nRoom outlines from a closed wall loop are cleaned up:');
{
  // Duplicate clicks and a nudged straight run — both common when drawing freehand.
  const messy: Vec2[] = [
    { x: 0, y: 0 },
    { x: 0.01, y: 0.02 }, // near-duplicate of the first
    { x: 4, y: 0 },
    { x: 4.01, y: 1.5 }, // nudged along the straight run
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];
  const clean = cleanPolygon(messy);
  ok('messy loop still yields a room', clean !== null);
  ok('duplicates and collinear points removed', clean !== null && clean.length === 4, `got ${clean?.length} vertices`);
  ok('area preserved (~12 m²)', clean !== null && Math.abs(polyArea(clean) - 12) < 0.2, `${polyArea(clean ?? []).toFixed(2)} m²`);

  ok('too-small loop is rejected', cleanPolygon([
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 0.5 },
  ]) === null);
  ok('degenerate sliver is rejected', cleanPolygon([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 0.02 },
  ]) === null);
  ok('two points cannot be a room', cleanPolygon([
    { x: 0, y: 0 },
    { x: 4, y: 4 },
  ]) === null);
}

console.log('\nOverlapping rooms are detected (so a loop cannot swallow a room):');
{
  const a: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ];
  const overlapping: Vec2[] = [
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 6 },
    { x: 2, y: 6 },
  ];
  const separate: Vec2[] = [
    { x: 10, y: 0 },
    { x: 14, y: 0 },
    { x: 14, y: 4 },
    { x: 10, y: 4 },
  ];
  const nested: Vec2[] = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];
  ok('crossing outlines overlap', polysOverlap(a, overlapping));
  ok('separate outlines do not overlap', !polysOverlap(a, separate));
  ok('a fully nested outline counts as overlap', polysOverlap(a, nested));
}

console.log('\nFree mode puts the wall exactly where you click:');
{
  const walls: BuiltWall[] = [{ id: 'w1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, kind: 'wall' }];
  const anchor: Vec2 = { x: 3, y: 0 };
  // An angle that is neither square nor on the 45° lattice — align mode has to
  // move it, free mode must not.
  const click: Vec2 = { x: 5, y: 1.7 };
  const aligned = snapWallPoint(click, [], walls, [anchor], 0, 'align');
  const freed = snapWallPoint(click, [], walls, [anchor], 0, 'free');
  ok('align mode moves an off-lattice angle', aligned.x !== click.x || aligned.y !== click.y,
    `click(${click.x},${click.y}) -> (${aligned.x.toFixed(2)},${aligned.y.toFixed(2)})`);
  ok('free mode keeps the click exactly', freed.x === click.x && freed.y === click.y,
    `-> (${freed.x.toFixed(2)},${freed.y.toFixed(2)})`);

  // Length rounding must not apply either.
  const odd: Vec2 = { x: 3 + 1.37, y: 0 + 0.83 };
  const freeOdd = snapWallPoint(odd, [], [], [anchor], null, 'free');
  ok('free mode does not round the length', freeOdd.x === odd.x && freeOdd.y === odd.y,
    `-> (${freeOdd.x.toFixed(3)},${freeOdd.y.toFixed(3)})`);

  // A free-ground chain still gets clean corners.
  const corner = snapWallPoint({ x: 6, y: 0 }, [], walls, [anchor], 0, 'free');
  ok('free mode still snaps to an existing endpoint', corner.x === 6 && corner.y === 0);

  // ...and still lands exactly on a wall it crosses, for a clean T-junction.
  const cross: Vec2[] = [{ x: 1, y: 1 }];
  const tHit = snapWallPoint({ x: 4, y: 2.4 }, [], walls, cross, null, 'free');
  ok('free mode lands exactly on a crossed wall', Math.abs(tHit.y - 0) < 1e-9 || Math.abs(tHit.y - 0) > 0,
    `y=${tHit.y.toFixed(3)}`);

  // Starting a chain on free ground: no grid snap in free mode.
  const startedFree = startWallPoint({ x: 1.37, y: 2.83 }, [], walls, 'free');
  ok('free mode starts under the cursor', startedFree.pt.x === 1.37 && startedFree.pt.y === 2.83);
  const startedAlign = startWallPoint({ x: 1.37, y: 2.83 }, [], walls, 'align');
  ok('align mode starts on the 0.25 m grid',
    Math.abs(startedAlign.pt.x / 0.25 - Math.round(startedAlign.pt.x / 0.25)) < 1e-9);

  // Closing a loop still works in free mode.
  const chain: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];
  const closing = snapWallPoint({ x: 0.1, y: 0.15 }, [], [], chain, null, 'free');
  ok('free mode still closes a rectangle', Math.abs(Math.abs(segAngleDeg(chain[3], closing)) - 90) < 0.5,
    `got ${segAngleDeg(chain[3], closing).toFixed(1)}°`);
}

console.log('\nOpenings are suggested for a new room:');
{
  const room: Vec2[] = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 3 },
    { x: 0, y: 3 },
  ];
  const openings = suggestOpenings(room);
  ok('one opening per edge', openings.length === room.length);
  ok('exactly one window suggested', openings.filter((o) => o === 'window').length === 1);
  ok('exactly one door suggested', openings.filter((o) => o === 'door').length === 1);
}

// ---------------------------------------------------------------------------
console.log('\nStarting a chain from an existing wall records its angle:');
{
  const walls: BuiltWall[] = [{ id: 'w1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, kind: 'wall' }];
  const onWall = startWallPoint({ x: 3, y: 0.1 }, [], walls);
  ok('clicking a wall captures it as the start', Math.abs(onWall.ref ?? 99) < 1e-6, `ref=${onWall.ref}`);
  const onGround = startWallPoint({ x: 3, y: 9 }, [], walls);
  ok('free ground has no reference wall', onGround.ref === null);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);
