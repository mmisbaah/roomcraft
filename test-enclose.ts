/**
 * Walls enclose floor; this works out which stretches.
 *
 * The everyday case is a room whose fourth wall belongs to the neighbour drawn
 * before it — the loop closes without the user ever clicking back to the start
 * — plus the cases that must NOT be mistaken for a room: a partition with a
 * dangling end, a T-junction, and two rooms sharing a wall.
 */
import { findEnclosedFaces } from './src/logic/enclose';
import { polysOverlap } from './src/logic/geometry';
import type { BuiltWall, Vec2 } from './src/types';

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Build walls from a path of corners, closing the loop implicitly. */
function wallsOf(name: string, pts: Vec2[]): BuiltWall[] {
  return pts.map((a, i) => ({
    id: `${name}${i}`,
    a,
    b: pts[(i + 1) % pts.length],
    kind: 'wall' as const,
  }));
}
const w = (id: string, a: Vec2, b: Vec2): BuiltWall => ({ id, a, b, kind: 'wall' });

console.log('A square of four walls is one room:');
{
  const walls = wallsOf('a', [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ]);
  const faces = findEnclosedFaces(walls);
  ok('exactly one face', faces.length === 1, `${faces.length}`);
  ok('its area is the square', Math.abs((faces[0]?.area ?? 0) - 12) < 0.001,
    `area=${faces[0]?.area}`);
  ok('it uses all four walls', faces[0]?.wallIds.length === 4, `${faces[0]?.wallIds.length}`);
}

console.log('\nAn open partition encloses nothing:');
{
  const walls = [
    w('a', { x: 0, y: 0 }, { x: 0, y: 3 }),
    w('b', { x: 0, y: 3 }, { x: 4, y: 3 }),
  ];
  ok('no face', findEnclosedFaces(walls).length === 0);
}
{
  // The screenshot's shape: three sides drawn, the fourth already in place.
  const walls = [
    w('a', { x: 0, y: 0 }, { x: 0, y: 4 }),
    w('b', { x: 0, y: 4 }, { x: 4, y: 4 }),
    w('c', { x: 4, y: 4 }, { x: 4, y: 0 }),
    // and the neighbour's wall closing the right-hand side
    w('d', { x: 4, y: 0 }, { x: 0, y: 0 }),
  ];
  const faces = findEnclosedFaces(walls);
  ok('three new sides plus a borrowed one is a room', faces.length === 1, `${faces.length}`);
  ok('and it is the right size', Math.abs((faces[0]?.area ?? 0) - 16) < 0.001,
    `area=${faces[0]?.area}`);
}

console.log('\nTwo rooms sharing a wall are two rooms:');
{
  // Side by side, with one wall between them — the shared wall has to end up
  // in both faces, or turning one into a room would tear the other in half.
  const walls = [
    w('left', { x: 0, y: 0 }, { x: 0, y: 3 }),
    w('topA', { x: 0, y: 3 }, { x: 4, y: 3 }),
    w('topB', { x: 4, y: 3 }, { x: 7, y: 3 }),
    w('shared', { x: 4, y: 3 }, { x: 4, y: 0 }),
    w('botA', { x: 4, y: 0 }, { x: 0, y: 0 }),
    w('botB', { x: 7, y: 0 }, { x: 4, y: 0 }),
    w('right', { x: 7, y: 3 }, { x: 7, y: 0 }),
  ];
  const faces = findEnclosedFaces(walls);
  ok('both enclosed areas are found', faces.length === 2,
    `${faces.length}: ${faces.map((f) => f.area.toFixed(2)).join(', ')}`);
  const areas = faces.map((f) => f.area).sort((a, b) => a - b);
  ok('with the right areas', Math.abs(areas[0] - 9) < 0.01 && Math.abs(areas[1] - 12) < 0.01,
    areas.join(', '));
  ok('the wall between them belongs to both',
    faces.every((f) => f.wallIds.includes('shared')),
    faces.map((f) => f.wallIds.join('|')).join('  '));
}

console.log('\nA wall left dangling into the next room does not merge them:');
{
  const walls = [
    w('a', { x: 0, y: 0 }, { x: 0, y: 3 }),
    w('b', { x: 0, y: 3 }, { x: 4, y: 3 }),
    w('c', { x: 4, y: 3 }, { x: 4, y: 0 }),
    w('d', { x: 4, y: 0 }, { x: 0, y: 0 }),
    // a stub poking out of the corner — must not open the room up
    w('stub', { x: 4, y: 0 }, { x: 5, y: 0 }),
  ];
  const faces = findEnclosedFaces(walls);
  ok('the room stays one room', faces.length === 1, `${faces.length}`);
  ok('and keeps its full area', Math.abs((faces[0]?.area ?? 0) - 12) < 0.01,
    `area=${faces[0]?.area}`);
}

console.log('\nA T-junction is not a room:');
{
  const walls = [
    w('a', { x: 0, y: 0 }, { x: 4, y: 0 }),
    w('b', { x: 4, y: 0 }, { x: 4, y: 3 }),
    w('c', { x: 4, y: 3 }, { x: 2, y: 3 }), // dead end
    w('d', { x: 2, y: 3 }, { x: 2, y: 0 }),
  ];
  // d closes back to the first wall's line but not to the wall itself, so this
  // is only enclosed if the junction is welded; it must not invent a room.
  const faces = findEnclosedFaces(walls);
  ok('nothing is enclosed by a partition with two dead ends', faces.length === 0,
    `${faces.length}: ${faces.map((f) => f.area.toFixed(2)).join(', ')}`);
}

console.log('\nA room with a hole in its middle is just the room:');
{
  // The inner dangling loop does not bound anything (it has no closed ring),
  // so only the outer floor should come back.
  const walls = [
    ...wallsOf('o', [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 5 },
      { x: 0, y: 5 },
    ]),
    w('p1', { x: 2, y: 2 }, { x: 4, y: 2 }),
    w('p2', { x: 4, y: 2 }, { x: 4, y: 3 }),
    w('p3', { x: 4, y: 3 }, { x: 2, y: 3 }),
    w('p4', { x: 2, y: 3 }, { x: 2, y: 2 }), // closes on itself -> a post, not a room
  ];
  const faces = findEnclosedFaces(walls);
  const real = faces.filter((f) => f.area > 4);
  ok('one real room', real.length === 1, `${faces.map((f) => f.area.toFixed(2)).join(', ')}`);
  ok('the full 30 m²', real.length === 1 && Math.abs(real[0].area - 30) < 0.01,
    `${real[0]?.area}`);
}

console.log('\nSnapping drift still welds:');
{
  // A wall traced against a room outline can land a few mm off its corner.
  const d = 0.01;
  const walls = [
    w('a', { x: 0, y: 0 }, { x: 4, y: 0 }),
    w('b', { x: 4 + d, y: d }, { x: 4 + d, y: 3 }),
    w('c', { x: 4 + d, y: 3 }, { x: 0, y: 3 + d }),
    w('d', { x: 0, y: 3 + d }, { x: 0, y: 0 }),
  ];
  const faces = findEnclosedFaces(walls);
  ok('a 1 cm gap is still a closed loop', faces.length === 1, `${faces.length}`);
}

console.log('\nDegenerate input is safe:');
{
  ok('no walls', findEnclosedFaces([]).length === 0);
  ok('one wall', findEnclosedFaces([w('a', { x: 0, y: 0 }, { x: 1, y: 0 })]).length === 0);
  ok('zero-length walls only',
    findEnclosedFaces([
      w('a', { x: 1, y: 1 }, { x: 1, y: 1 }),
      w('b', { x: 2, y: 2 }, { x: 2, y: 2 }),
      w('c', { x: 3, y: 3 }, { x: 3, y: 3 }),
    ]).length === 0);
  const doubled = findEnclosedFaces([
    w('a', { x: 0, y: 0 }, { x: 4, y: 0 }),
    w('b', { x: 0, y: 0 }, { x: 4, y: 0 }),
    w('c', { x: 0, y: 0 }, { x: 4, y: 0 }),
  ]);
  ok('walls stacked on the same line enclose nothing', doubled.length === 0, `${doubled.length}`);
}

console.log('\nCorners are reported in order:');
{
  const faces = findEnclosedFaces(
    wallsOf('a', [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]),
  );
  const poly = faces[0].poly;
  // Every consecutive pair must be a real edge of length 5 or 4, never a jump
  // across the room — i.e. the polygon is walked, not scrambled.
  let sane = true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 3.9 || d > 5.1) sane = false;
  }
  ok('consecutive corners are neighbours, not diagonals', sane,
    poly.map((p) => `(${p.x},${p.y})`).join(' '));
}

console.log('\nRooms that merely touch are not overlapping rooms:');
{
  // Sharing a wall is how a plan is drawn. Treating that as an overlap made a
  // room drawn against an existing one get refused with "it overlaps an
  // existing room" — the ray-cast from a vertex sitting exactly on the shared
  // wall escapes through the far edge and reports "inside".
  const left: Vec2[] = [
    { x: 4, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: 4, y: 3 },
  ];
  const right: Vec2[] = [
    { x: 7, y: 3 },
    { x: 4, y: 3 },
    { x: 4, y: 0 },
    { x: 7, y: 0 },
  ];
  ok('a shared wall is not an overlap', !polysOverlap(left, right));
  ok('and not the other way round', !polysOverlap(right, left));
  // Order must not matter — the old vertex test was order-sensitive.
  ok('nor with the vertices wound the other way',
    !polysOverlap(left, [...right].reverse()) && !polysOverlap([...left].reverse(), right));
}
{
  const room: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];
  const overlapping: Vec2[] = [
    { x: 2, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 4 },
    { x: 2, y: 4 },
  ];
  ok('a genuine overlap is still caught', polysOverlap(room, overlapping));
  ok('and from either side', polysOverlap(overlapping, room));
  const inside: Vec2[] = [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 2 },
    { x: 1, y: 2 },
  ];
  ok('a room wholly inside another is caught', polysOverlap(room, inside));
  ok('identical outlines count as overlapping', polysOverlap(room, room.map((p) => ({ ...p }))));
  const apart: Vec2[] = [
    { x: 10, y: 0 },
    { x: 14, y: 0 },
    { x: 14, y: 3 },
    { x: 10, y: 3 },
  ];
  ok('a room across the plan is not', !polysOverlap(room, apart));
  const touchingAtACorner: Vec2[] = [
    { x: 4, y: 3 },
    { x: 7, y: 3 },
    { x: 7, y: 6 },
    { x: 4, y: 6 },
  ];
  ok('rooms meeting at a single corner are not', !polysOverlap(room, touchingAtACorner));
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);