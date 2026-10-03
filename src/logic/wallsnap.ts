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
  // 3) Free ground: plain grid start, no alignment source.
  const SNAP = 0.25;
  return { pt: { x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP }, ref: null };
}

/** Distance at which a click counts as closing the loop onto its start point. */
export const CLOSE_RADIUS = 0.45;

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
): Vec2 {
  const SNAP = 0.25;
  const best = nearestVert(p, wallVerts(polys, walls).concat(chain), 0.3);
  if (best) return { x: best.x, y: best.y };

  // Starting fresh: fall back to the start rules (wall projection / grid).
  if (!chain.length) return startWallPoint(p, polys, walls).pt;

  const anchor = chain[chain.length - 1];
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0.2) {
    return { x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP };
  }

  // The wall this segment joins. Normally the chain's source wall, but when the
  // click is closing a free-standing loop the joint it will make is with the
  // chain's *first* segment — that is the wall the rectangle has to square up
  // against, otherwise the loop closes as a sliver.
  const closing =
    ref === null &&
    chain.length >= 2 &&
    Math.hypot(p.x - chain[0].x, p.y - chain[0].y) < CLOSE_RADIUS;
  let base = ref;
  if (closing) base = Math.atan2(chain[1].y - chain[0].y, chain[1].x - chain[0].x);

  const rawAng = Math.atan2(dy, dx);
  let ang: number;
  if (base !== null && Math.abs(lineAngleDiff(rawAng, base)) < RECT_SNAP) {
    // Square up to the joined wall. Pick the perpendicular on the side the
    // cursor is actually on so the new wall goes where the user is aiming.
    const side = Math.cos(base) * dy - Math.sin(base) * dx;
    ang = base + (side >= 0 ? 1 : -1) * (Math.PI / 2);
  } else {
    const b = base ?? 0;
    const k = Math.round((rawAng - b) / (Math.PI / 4));
    // The 45° lattice is offsets *away from* the joined wall. A 0° offset would
    // run parallel to the wall it connects to — a degenerate join that can
    // never enclose a room — so the nearest usable step is 45°.
    const step = base !== null && k === 0 ? (rawAng - b > 0 ? 1 : -1) : k;
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