// Geometry for drawing walls with the 🧱 tool.
//
// Kept apart from the store so it can be unit-tested directly: wall snapping
// is fiddly, fussy, and a silent regression here is invisible on screen —
// walls just land somewhere slightly wrong. All functions take the room
// outlines as a list of polygons so a plan with several rooms snaps against
// every one of them.

import { distPointSeg } from './geometry';
import type { BuiltWall, EdgeKind, Vec2 } from '../types';

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Every wall line: room outline edges + built partitions. */
export function wallSegments(polys: Vec2[][], walls: BuiltWall[]): { a: Vec2; b: Vec2 }[] {
  const segs: { a: Vec2; b: Vec2 }[] = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) segs.push({ a: poly[i], b: poly[(i + 1) % poly.length] });
  }
  for (const w of walls) segs.push({ a: w.a, b: w.b });
  return segs;
}

/** All vertices of the room outlines + built walls. */
export function wallVerts(polys: Vec2[][], walls: BuiltWall[]): Vec2[] {
  const verts: Vec2[] = [];
  for (const poly of polys) verts.push(...poly);
  for (const w of walls) verts.push(w.a, w.b);
  return verts;
}

/** Nearest vertex of `verts` to p within maxD, or null. */
export function nearestVert(p: Vec2, verts: Vec2[], maxD: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = maxD;
  for (const v of verts) {
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

/** The point on segment a→b closest to p (clamped to the segment). */
export function projectOnSeg(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** Wall segment whose line passes closest to p (within maxD), or null. */
export function nearestWallLine(
  p: Vec2,
  segs: { a: Vec2; b: Vec2 }[],
  maxD: number,
): { a: Vec2; b: Vec2 } | null {
  let best: { a: Vec2; b: Vec2 } | null = null;
  let bd = maxD;
  for (const s of segs) {
    const d = distPointSeg(p, s.a, s.b);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Intersection of the ray A + t·dir (t > 0.1) with segment c→e, or null. */
export function raySegHit(A: Vec2, dir: Vec2, c: Vec2, e: Vec2): Vec2 | null {
  const sx = e.x - c.x;
  const sy = e.y - c.y;
  const denom = dir.x * sy - dir.y * sx;
  if (Math.abs(denom) < 1e-9) return null; // parallel / colinear
  const rx = c.x - A.x;
  const ry = c.y - A.y;
  const t = (rx * sy - ry * sx) / denom;
  const u = (rx * dir.y - ry * dir.x) / denom;
  if (t <= 0.1 || u < 0 || u > 1) return null;
  return { x: A.x + dir.x * t, y: A.y + dir.y * t };
}

/**
 * Where the aligned ray from `anchor` crosses a wall within maxD of the click
 * p — landing exactly on that wall (a clean T-junction) instead of near it.
 */
export function rayWallHit(
  anchor: Vec2,
  dir: Vec2,
  polys: Vec2[][],
  walls: BuiltWall[],
  p: Vec2,
  maxD: number,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = maxD;
  for (const s of wallSegments(polys, walls)) {
    const q = raySegHit(anchor, dir, s.a, s.b);
    if (!q) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/**
 * Signed difference between two *undirected* line angles, folded into
 * (-90°, 90°]. Line direction ignores which way you walk along it, so 0° means
 * parallel and ±90° means square.
 */
export function lineAngleDiff(a: number, b: number): number {
  let d = (a - b) % Math.PI;
  if (d > Math.PI / 2) d -= Math.PI;
  if (d <= -Math.PI / 2) d += Math.PI;
  return d;
}

/**
 * Below this angle a new wall counts as "parallel" to the wall it joins.
 * A partition that merely shadows the wall it connects to is never what anyone
 * means, and it can't enclose a room, so it gets squared up into a rectangle.
 */
export const RECT_SNAP_DEG = 10;
export const RECT_SNAP = (RECT_SNAP_DEG * Math.PI) / 180;

/**
 * Where a wall chain should start, plus the angle of the wall it is drawn
 * from. Priority: exact vertex → projection onto the wall under the cursor
 * (the new wall then aligns to it) → free 0.25 m grid start (no source wall).
 */
export function startWallPoint(
  p: Vec2,
  polys: Vec2[][],
  walls: BuiltWall[],
  mode: WallSnapMode = 'align',
): { pt: Vec2; ref: number | null } {
  const segs = wallSegments(polys, walls);
  // 1) Room corner / wall endpoint — the strongest connection.
  const v = nearestVert(p, wallVerts(polys, walls), 0.3);
  if (v) {
    // Of the walls running through that vertex, the one the raw click lies
    // closest to is the wall the user is drawing from.
    let ref: number | null = null;
    let bd = Infinity;
    for (const s of segs) {
      if (distPointSeg(v, s.a, s.b) > 0.01) continue; // not incident to the vertex
      const d = distPointSeg(p, s.a, s.b);
      if (d < bd) {
        bd = d;
        ref = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
      }
    }
    return { pt: v, ref };
  }
  // 2) Snap onto the wall under the cursor — that wall sets the alignment.
  const seg = nearestWallLine(p, segs, 0.25);
  if (seg) {
    return {
      pt: projectOnSeg(p, seg.a, seg.b),
      ref: Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x),
    };
  }
  // 3) Free ground. In free mode the wall starts exactly under the cursor; in
  // align mode it lands on the 0.25 m grid.
  if (mode === 'free') return { pt: { x: p.x, y: p.y }, ref: null };
  const SNAP = 0.25;
  return { pt: { x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP }, ref: null };
}

/** Distance at which a click counts as closing the loop onto its start point. */
export const CLOSE_RADIUS = 0.45;

/**
 * True when `anchor` is a **corner** of an existing room outline, or the
 * chain's own corner when closing a loop.
 *
 * This is the one place where a wall running parallel to `dir` is legitimate.
 * Tracing a room means going along one wall and then turning at its corner, so
 * at a corner the new wall may simply carry on in the same direction — two room
 * walls meet there, and squaring that up makes it impossible to trace a room
 * wall by wall. Everywhere else (part-way along a wall, or the free end of a
 * partition) a parallel run doubles back over the wall it started from and can
 * never enclose a space, so it is squared up instead.
 */
function isCorner(
  anchor: Vec2,
  dir: number,
  polys: Vec2[][],
  walls: BuiltWall[],
  chain: Vec2[],
): boolean {
  const near = (p: Vec2) => Math.hypot(anchor.x - p.x, anchor.y - p.y) < 1e-6;
  const along = (a: Vec2, b: Vec2) =>
    Math.abs(lineAngleDiff(Math.atan2(b.y - a.y, b.x - a.x), dir)) < 0.02;

  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      // Two room edges meeting here means it is a corner.
      if (!near(a)) continue;
      const prev = poly[(i - 1 + poly.length) % poly.length];
      if (along(prev, a) || along(a, b)) return true;
    }
  }
  // The chain's own start point is a corner while closing a free-standing loop.
  if (chain.length >= 2 && near(chain[0]) && along(chain[0], chain[1])) return true;
  return false;
}

/**
 * How a wall click is resolved.
 *
 *  - `align` locks each segment to the joined wall + a 45° step and rounds
 *    lengths to 0.25 m. Tidy, and how most floorplans are drawn.
 *  - `free` puts the wall exactly under the cursor. Only corners and exact
 *    T-junctions are still caught, so an angled wall really can be drawn at the
 *    angle you drew it — the lattice otherwise refuses anything that isn't a
 *    multiple of 45°, which is the usual reason a plan won't look the way you
 *    pictured it.
 */
export type WallSnapMode = 'align' | 'free';

/**
 * Snap a wall click. Vertices win (corners make the cleanest joints). With a
 * chain in progress the direction locks to the joined wall + k*45° — parallel,
 * square or diagonal — with one exception: a segment within 10° of the wall it
 * joins is squared up to a right angle instead, because a near-parallel
 * partition can never enclose a room. Lengths round to 0.25 m, and the point
 * lands exactly on any wall the aligned ray crosses close to the click.
 * Exported so the canvas previews exactly where a click will land.
 */
export function snapWallPoint(
  p: Vec2,
  polys: Vec2[][],
  walls: BuiltWall[],
  chain: Vec2[],
  ref: number | null,
  mode: WallSnapMode = 'align',
): Vec2 {
  const SNAP = 0.25;
  // Free mode keeps only the things a hand-drawn floorplan still needs: exact
  // corners and clean T-junctions. No angle lattice, no length rounding — the
  // click lands where the click was.
  const gridSnap = mode === 'align';
  const best = nearestVert(p, wallVerts(polys, walls).concat(chain), 0.3);
  if (best) return { x: best.x, y: best.y };

  // Starting fresh: fall back to the start rules (wall projection / grid).
  if (!chain.length) {
    const s = startWallPoint(p, polys, walls, mode);
    return gridSnap || s.ref !== null ? s.pt : { x: p.x, y: p.y };
  }

  const anchor = chain[chain.length - 1];
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0.2) {
    return gridSnap
      ? { x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP }
      : { x: p.x, y: p.y };
  }

  // Free mode: the wall goes exactly where the cursor is, but still lands
  // exactly on a wall it crosses (a clean T-junction rather than a near miss).
  if (mode === 'free') {
    const hit = rayWallHit(anchor, { x: dx / len, y: dy / len }, polys, walls, p, 0.25);
    return hit ?? { x: p.x, y: p.y };
  }

  // The angle this segment is measured against.
  //
  // Once a chain is under way it follows its own previous segment, not the wall
  // it happened to start on. Tracing a room outline is the everyday case —
  // down the left wall, then a right turn along the bottom — and measuring the
  // turn against the *original* wall makes every 90° turn look parallel to it,
  // so the turn gets squared up into a reversal. Measuring against the previous
  // segment is what "snap to 45°" is supposed to mean, and it still keeps every
  // segment parallel or square to the wall the chain started from.
  const closing =
    ref === null &&
    chain.length >= 2 &&
    Math.hypot(p.x - chain[0].x, p.y - chain[0].y) < CLOSE_RADIUS;
  let base: number | null;
  if (chain.length >= 2) {
    const prev = chain[chain.length - 1];
    const before = chain[chain.length - 2];
    base = Math.atan2(prev.y - before.y, prev.x - before.x);
  } else if (closing) {
    base = Math.atan2(chain[1].y - chain[0].y, chain[1].x - chain[0].x);
  } else {
    base = ref;
  }

  /**
   * A near-parallel segment is only squared up away from a corner. Tracing a
   * room is wall-by-wall around its corners, so at a corner the new wall may
   * carry straight on; part-way along a wall, or at the free end of a
   * partition, running parallel doubles back over the wall it started from and
   * can never enclose a space, so it becomes a right angle instead.
   */
  const atCorner = base !== null && isCorner(anchor, base, polys, walls, chain);
  const mustSquare = base !== null && !atCorner;

  const rawAng = Math.atan2(dy, dx);
  let ang: number;
  if (mustSquare && Math.abs(lineAngleDiff(rawAng, base)) < RECT_SNAP) {
    // Square up to the joined wall. Pick the perpendicular on the side the
    // cursor is actually on so the new wall goes where the user is aiming.
    const side = Math.cos(base) * dy - Math.sin(base) * dx;
    ang = base + (side >= 0 ? 1 : -1) * (Math.PI / 2);
  } else {
    const b = base ?? 0;
    const k = Math.round((rawAng - b) / (Math.PI / 4));
    // Away from a corner the 45° lattice starts one step off the joined wall,
    // since a 0° offset would run along it. At a corner, 0° is a legitimate
    // aim and is taken at face value.
    const step = mustSquare && k === 0 ? (rawAng - b > 0 ? 1 : -1) : k;
    ang = b + step * (Math.PI / 4);
  }
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };

  // Terminating exactly on a wall the aligned ray crosses close to the click
  // beats rounding — a partition meets the wall it was aimed at cleanly
  // (T-junction), and the result is still within 0.4 m of the raw click.
  const hit = rayWallHit(anchor, dir, polys, walls, p, 0.4);
  if (hit) return hit;

  // Round the length (never x/y) so rotated chains stay exactly on the axis.
  const len2 = Math.max(SNAP, Math.round(len / SNAP) * SNAP);
  return { x: anchor.x + dir.x * len2, y: anchor.y + dir.y * len2 };
}

/** Suggest one window (longest edge) and one door (shortest edge). */
export function suggestOpenings(poly: Vec2[]): EdgeKind[] {
  const n = poly.length;
  const lens = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const openings: EdgeKind[] = new Array(n).fill('wall');
  let longest = 0;
  let shortest = 0;
  lens.forEach((l, i) => {
    if (l > lens[longest]) longest = i;
    if (l < lens[shortest]) shortest = i;
  });
  openings[longest] = 'window';
  openings[shortest] = 'door';
  return openings;
}