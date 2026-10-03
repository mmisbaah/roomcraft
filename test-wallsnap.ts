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
