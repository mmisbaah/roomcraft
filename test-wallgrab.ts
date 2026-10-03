/**
 * "Finish move": grabbing the last wall point and re-positioning it.
 *
 * The point has to behave exactly as if it were being placed fresh, because the
 * user has just placed it and wants it nudged — not dropped onto some different
 * corner of the snap lattice. These checks pin that down: what the grab
 * targets, that re-snapping matches a fresh placement, that it cannot snap onto
 * itself, and that both endings (keep / undo) restore the right thing.
 */
import './test-dom-stub';
import { useStore } from './src/store';

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Runs a check but records a crash as a failure, so one bad probe can't end the run. */
function attempt(label: string, fn: () => { pass: boolean; detail?: string }) {
  try {
    const r = fn();
    ok(label, r.pass, r.detail);
  } catch (err) {
    ok(label, false, `threw: ${(err as Error).message}`);
  }
}

const S = () => useStore.getState();
const draft = () => S().wallDraft ?? [];
const last = () => {
  const d = draft();
  return d[d.length - 1] ?? null;
};
const close = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

/** Fresh wall tool, no rooms, no built walls. */
function fresh() {
  S().clearRoom();
  S().setWallBuild(true);
  S().setWallSnap('align');
}

/** Lay a chain of exact world points through the wall tool. */
function lay(...pts: [number, number][]) {
  for (const [x, y] of pts) S().addWallPoint({ x, y });
}

console.log('Grabbing targets the last clicked point:');
{
  fresh();
  lay([0, 0], [4, 0], [4, 3]);
  S().grabWallPoint();
  const g = S().wallGrab;
  ok('a grab is registered', g !== null);
  ok('it targets the last point', g?.index === 2, `index=${g?.index}`);
  ok('and remembers where that point was', g ? close(g.orig, { x: 4, y: 3 }) : false,
    g ? `orig=(${g.orig.x},${g.orig.y})` : '');
  S().finishWallGrab();
}
{
  // The button must never reach further back than the newest point, so the
  // earlier corners of the chain stay put.
  fresh();
  lay([0, 0], [4, 0], [4, 3]);
  const before = draft().map((p) => ({ ...p }));
  S().grabWallPoint();
  S().moveWallGrab({ x: 9, y: 9 });
  const after = draft();
  ok('earlier points are untouched by the move',
    close(after[0], before[0]) && close(after[1], before[1]),
    `p0=(${after[0].x},${after[0].y}) p1=(${after[1].x},${after[1].y})`);
  S().finishWallGrab();
}

console.log('\nGrabbing needs a segment to correct:');
{
  fresh();
  lay([0, 0]);
  S().grabWallPoint();
  ok('a single point cannot be grabbed', S().wallGrab === null);
  lay([3, 0]);
  S().grabWallPoint();
  ok('two points can be', S().wallGrab !== null);
  S().finishWallGrab();
}
{
  fresh();
  S().grabWallPoint();
  ok('no chain at all cannot be grabbed', S().wallGrab === null);
}

console.log('\nA grabbed point re-snaps like a fresh placement:');
{
  // Anchor for the move is the point before the grabbed one, so the same 45°
  // lattice and 0.25 m length steps apply that governed the original click.
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 3.4, y: 5.9 });
  const p = last()!;
  const anchor = { x: 0, y: 4 };
  const ang = Math.atan2(p.y - anchor.y, p.x - anchor.x);
  const base = Math.PI / 2; // the previous segment runs +y
  const steps = (ang - base) / (Math.PI / 4);
  ok('the new direction sits on the 45° lattice', Math.abs(steps - Math.round(steps)) < 1e-9,
    `angle=${((ang * 180) / Math.PI).toFixed(2)}° = base + ${Math.round(steps)}x45°`);
  const len = Math.hypot(p.x - anchor.x, p.y - anchor.y);
  ok('the length rounds to the 0.25 m step', Math.abs(len * 4 - Math.round(len * 4)) < 1e-9,
    `len=${len.toFixed(4)}`);
  ok('and the point really moved', !close(p, { x: 3, y: 4 }), `(${p.x},${p.y})`);
  S().finishWallGrab();
}
{
  // A snapped point is a fixed point of its own snapper, so grabbing it and
  // moving it onto itself must change nothing. That is what makes the grab feel
  // like a correction of the existing chain rather than a second, unrelated
  // placement rule.
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  const placed = { ...last()! };
  S().grabWallPoint();
  S().moveWallGrab({ ...placed });
  ok('grabbing a point and dropping it where it already is is a no-op',
    close(last()!, placed), `(${last()!.x},${last()!.y}) want (${placed.x},${placed.y})`);
  S().finishWallGrab();
}
{
  // The anchor is the point *before* the grabbed one, so a 4-point chain moves
  // its last corner against the third point, not against its own old position.
  fresh();
  lay([0, 0], [4, 0], [4, 3]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 9, y: 9 });
  const p = last()!;
  const anchor = { x: 4, y: 0 }; // the point *before* the grabbed one
  const len = Math.hypot(p.x - anchor.x, p.y - anchor.y);
  ok('the new segment measures from the previous point',
    Math.abs(len * 4 - Math.round(len * 4)) < 1e-9, `len=${len.toFixed(4)}`);
  ok('not from where the grabbed point used to be',
    !close(p, { x: 4, y: 0 }) && !close(p, { x: 9, y: 9 }), `(${p.x},${p.y})`);
  S().finishWallGrab();
}

console.log('\nFree mode stays exact while grabbing:');
{
  fresh();
  S().setWallSnap('free');
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 2.37, y: 6.11 });
  const p = last()!;
  ok('the point follows the cursor exactly', close(p, { x: 2.37, y: 6.11 }),
    `(${p.x},${p.y})`);
  S().finishWallGrab();
}

console.log('\nA grabbed point cannot snap onto itself:');
{
  // The grabbed point is excluded from the snapper's vertex list, so a drag
  // that stays within snapping distance of where the point already is must NOT
  // magnetise back to that old position. If it did, the point would refuse to
  // move by small amounts and the grab would feel broken.
  fresh();
  S().setWallSnap('free');
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 3.15, y: 4 });
  attempt('a small drag off the point is not undone by snapping', () => {
    const p = last();
    return {
      pass: !!p && !close(p, { x: 3, y: 4 }) && close(p, { x: 3.15, y: 4 }),
      detail: p ? `(${p.x},${p.y})` : 'draft is gone',
    };
  });
  S().finishWallGrab();
}
{
  // A genuine vertex still wins: moving onto the chain's start is a real snap
  // to a real corner, not the self-snap case above.
  fresh();
  S().setWallSnap('free');
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 0.1, y: 0.1 });
  attempt('but a real corner still captures it', () => {
    const p = last();
    return { pass: !!p && close(p, { x: 0, y: 0 }), detail: p ? `(${p.x},${p.y})` : 'draft is gone' };
  });
  S().finishWallGrab();
}

console.log('\nFinishing keeps the point, cancelling puts it back:');
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 6, y: 7 });
  const moved = { ...last()! };
  S().finishWallGrab();
  ok('Done clears the grab', S().wallGrab === null);
  ok('Done keeps the moved point', close(last()!, moved), `(${last()!.x},${last()!.y})`);
  ok('the chain keeps its length', draft().length === 3, `${draft().length}`);
}
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  const before = draft().map((p) => ({ ...p }));
  S().grabWallPoint();
  S().moveWallGrab({ x: 6, y: 7 });
  S().moveWallGrab({ x: 8, y: 9 });
  ok('it moved away first', !close(last()!, before[2]));
  S().cancelWallGrab();
  ok('Esc restores the original point exactly',
    draft().every((p, i) => close(p, before[i])),
    `(${last()!.x},${last()!.y}) want (${before[2].x},${before[2].y})`);
  ok('Esc clears the grab', S().wallGrab === null);
}
{
  // Several nudges then an undo: the undo returns to where the grab started,
  // not to some intermediate step.
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  const start = { ...draft()[2] };
  S().grabWallPoint();
  for (const t of [{ x: 3.5, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 8 }]) S().moveWallGrab(t);
  S().cancelWallGrab();
  ok('undo after three nudges returns to the grab point', close(last()!, start),
    `(${last()!.x},${last()!.y})`);
}

console.log('\nMoving without a grab changes nothing:');
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  const before = draft().map((p) => ({ ...p }));
  S().moveWallGrab({ x: 9, y: 9 });
  ok('a stray move is ignored', draft().every((p, i) => close(p, before[i])));
}

console.log('\nThe grab is cleared by everything that ends it:');
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().addWallPoint({ x: 6, y: 7 });
  ok('placing a new point supersedes the grab', S().wallGrab === null);
}
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().finishWallDraft();
  ok('finishing the chain clears the grab', S().wallGrab === null && S().wallDraft === null);
}
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().setWallBuild(false);
  ok('leaving the tool clears the grab', S().wallGrab === null);
}
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().clearRoom();
  ok('clearing the plan clears the grab', S().wallGrab === null);
}
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().setEdgeEdit(true);
  ok('switching to edge edit clears the grab', S().wallGrab === null);
}

console.log('\nA loop closed after a move is still a room:');
{
  fresh();
  lay([0, 0], [5, 0], [5, 4]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 3, y: 4 }); // pull the corner in before closing
  const moved = { ...last()! };
  S().finishWallGrab();
  S().addWallPoint({ x: 0, y: 0 }); // click the first point to close the loop
  attempt('closing the loop makes a room', () => ({
    pass: S().rooms.length === 1,
    detail: `${S().rooms.length} rooms`,
  }));
  const r = S().rooms[0];
  attempt('the moved corner is part of its outline', () => ({
    pass: !!r && r.poly.some((p) => close(p, moved)),
    detail: r ? `moved=(${moved.x},${moved.y}) poly=${JSON.stringify(r.poly)}` : 'no room',
  }));
  attempt('and the loop walls were absorbed into it', () => ({
    pass: S().walls.length === 0,
    detail: `${S().walls.length} walls left`,
  }));
}

console.log('\nA loop too small to be a room keeps its walls:');
{
  // Regression: the loop's walls used to be deleted before the outline was
  // validated, so this path announced "it stayed walls" after discarding them.
  // Free snapping so the loop is exactly 1.5 x 1.5 — under the 4 m² a room
  // must be, but well clear of the snapping steps that would shrink a 30 cm
  // square into a single point.
  fresh();
  S().setWallSnap('free');
  lay([0, 0], [1.5, 0], [1.5, 1.5], [0, 1.5]);
  S().addWallPoint({ x: 0, y: 0 });
  attempt('no room is made', () => ({ pass: S().rooms.length === 0, detail: `${S().rooms.length}` }));
  attempt('but all four walls survive', () => ({
    pass: S().walls.length === 4,
    detail: `${S().walls.length} walls`,
  }));
  attempt('and the chain is cleared', () => ({ pass: S().wallDraft === null }));
}

console.log('\nA moved point survives into the finished walls:');
{
  fresh();
  lay([0, 0], [0, 4], [3, 4]);
  S().grabWallPoint();
  S().moveWallGrab({ x: 6, y: 4 });
  const moved = { ...last()! };
  S().finishWallGrab();
  S().finishWallDraft();
  const walls = S().walls;
  attempt('the chain became real walls', () => ({
    pass: walls.length === 2,
    detail: `${walls.length}`,
  }));
  attempt('the finished wall ends at the moved point', () => {
    const w = walls[1];
    if (!w) return { pass: false, detail: 'no second wall' };
    const ends = [w.a, w.b].some((e) => close(e, moved));
    return { pass: ends, detail: `want (${moved.x},${moved.y})` };
  });
}

S().setWallBuild(false);
S().clearRoom();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);