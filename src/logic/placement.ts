// Rule-based "best fit" furniture placement.
//
// Floor items: score every free grid cell anchor by
//   - wall affinity  (sofas/beds hug walls, rugs/tables centre)
//   - centre affinity (tables and rugs prefer the middle of the room)
//   - door clearance  (never block the entry)
// Wall items are projected onto the best free wall span; ceiling items hang
// over a table (or the room centre); surface items sit on a table top.

import type { EdgeKind, FurnItem, FurnType, PlacedItem, RoomKind, Vec2 } from '../types';
import { clamp01, distPointSeg, pointInPoly, polyArea, polyCentroid, rotatedSize, segsCross } from './geometry';
import { rectCells, type Grid } from './grid';
import { CLEARANCE } from './rules';

export interface EdgeInfo {
  a: Vec2;
  b: Vec2;
  kind: EdgeKind;
}

export interface PlacePrefs {
  wall: number;
  center: number;
  door: number;
}

export interface Spot {
  x: number;
  y: number;
  /** Degrees, counter-clockwise (floor items: multiples of 90; wall items: wall angle). */
  rot: number;
}

export const PREFS: Record<FurnType, PlacePrefs> = {
  seating: { wall: 0.8, center: 0.35, door: -1.4 },
  tables: { wall: 0.15, center: 1.0, door: -1.0 },
  storage: { wall: 1.0, center: 0.1, door: -0.8 },
  beds: { wall: 1.0, center: 0.2, door: -1.2 },
  ceilight: { wall: 0.0, center: 1.0, door: -0.2 },
  walllight: { wall: 1.0, center: 0.2, door: -1.5 },
  floorlamp: { wall: 0.8, center: 0.3, door: -0.6 },
  archlight: { wall: 0.6, center: 0.4, door: -0.3 },
  floorplants: { wall: 0.5, center: 0.5, door: -0.7 },
  tableplants: { wall: 0.2, center: 0.8, door: -0.5 },
  succulents: { wall: 0.2, center: 0.8, door: -0.5 },
  hangingplants: { wall: 0.2, center: 0.9, door: -0.3 },
  trees: { wall: 0.6, center: 0.4, door: -0.8 },
  textiles: { wall: 0.1, center: 1.1, door: -0.2 },
  walldecor: { wall: 1.0, center: 0.3, door: -1.6 },
  tabletop: { wall: 0.2, center: 0.8, door: -0.4 },
  functional: { wall: 0.9, center: 0.4, door: -1.2 },
  vanity: { wall: 1.0, center: 0.1, door: -1.0 },
  bathtub: { wall: 0.9, center: 0.3, door: -0.7 },
  shower: { wall: 0.8, center: 0.3, door: -0.7 },
  toilet: { wall: 1.0, center: -0.1, door: -1.6 },
  towelrack: { wall: 1.0, center: 0.3, door: -0.4 },
  vamirror: { wall: 1.0, center: 0.4, door: -0.6 },
};

/** Flat textiles (rugs, runners) — they don't block anything. */
export const isFlat = (f: FurnItem) => f.mount === 'floor' && !!f.spec.rug;
/** Floor items that occupy grid cells. */
const blocksFloor = (f: FurnItem) => f.mount === 'floor' && !f.spec.rug;

/** Pairs that may share cells (chairs tucked under tables; rugs under anything). */
function overlapsAllowed(a: FurnItem, b: FurnItem): boolean {
  if (isFlat(a) || isFlat(b)) return true;
  const t = new Set([a.type, b.type]);
  return t.has('tables') && t.has('seating');
}

const normDeg = (r: number) => ((r % 360) + 360) % 360;

/** Cells blocked by placed furniture (excluding one uid, rugs, wall/ceiling/surface pieces). */
export function occupiedCells(
  grid: Grid,
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  excludeUid?: string,
): Set<number> {
  const set = new Set<number>();
  for (const it of items) {
    if (it.uid === excludeUid) continue;
    const f = byId.get(it.itemId);
    if (!f || !blocksFloor(f)) continue;
    const { w, d } = rotatedSize(f.w, f.d, it.rot);
    const cells = rectCells(grid, it.x, it.y, w, d);
    if (cells) for (const c of cells) set.add(c);
  }
  return set;
}

/** Axis-aligned rotated-rect test: is the (possibly rotated) rect fully inside the polygon? */
export function rotRectInsidePoly(poly: Vec2[], x: number, y: number, w: number, d: number, rot: number): boolean {
  const r = (rot * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corners: Vec2[] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([lx, ly]) => ({ x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos }));
  for (const c of corners) if (!pointInPoly(c, poly)) return false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    for (let k = 0; k < 4; k++) {
      if (segsCross(poly[j], poly[i], corners[k], corners[(k + 1) % 4])) return false;
    }
  }
  return true;
}

/** Top surface height of a floor item, or null when it can't support anything. */
export function supportTop(f: FurnItem): number | null {
  if (f.mount !== 'floor') return null;
  if (f.type === 'tables') return f.h || f.spec.h || 0.75;
  if (f.type === 'vanity') return f.h; // countertop — soaps & succulents sit here
  if (f.type === 'storage') {
    const h = f.h || f.spec.h || 0.8;
    return h <= 1.35 ? h : null;
  }
  if (f.type === 'beds') return 0.52;
  if (f.type === 'seating') return (f.spec.seatH ?? 0.45) + 0.14;
  return null;
}

/** Highest support top under (x, y), or null when the point isn't on a support. */
export function supportAt(
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  x: number,
  y: number,
): number | null {
  let top: number | null = null;
  for (const it of items) {
    const f = byId.get(it.itemId);
    if (!f) continue;
    const st = supportTop(f);
    if (st == null) continue;
    const r = (it.rot * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const dx = x - it.x;
    const dy = y - it.y;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    if (Math.abs(lx) <= f.w / 2 + 0.03 && Math.abs(ly) <= f.d / 2 + 0.03) {
      if (top == null || st > top) top = st;
    }
  }
  return top;
}

/** Full validity check for a candidate placement. */
export function canPlace(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  x: number,
  y: number,
  rot: number,
  excludeUid?: string,
): boolean {
  if (item.mount === 'wall') {
    return rotRectInsidePoly(poly, x, y, item.w, item.d, rot);
  }
  if (item.mount === 'ceiling') {
    return rotRectInsidePoly(poly, x, y, item.w, item.d, rot);
  }
  if (item.mount === 'surface') {
    // On a table top it may sit anywhere the support reaches…
    if (supportAt(items, byId, x, y) != null) {
      return rotRectInsidePoly(poly, x, y, item.w, item.d, rot);
    }
    // …otherwise it stands on the floor and must respect the grid.
  }
  const { w, d } = rotatedSize(item.w, item.d, rot);
  const cells = rectCells(grid, x, y, w, d);
  if (!cells) return false;
  const flat = isFlat(item);
  const others = items.filter((i) => i.uid !== excludeUid && !isFlat(byId.get(i.itemId) ?? item));
  for (const idx of cells) {
    if (grid.free[idx] !== 1) return false;
    if (flat) continue;
    for (const o of others) {
      const f = byId.get(o.itemId);
      if (!f || !blocksFloor(f) || overlapsAllowed(item, f)) continue;
      const os = rotatedSize(f.w, f.d, o.rot);
      const oc = rectCells(grid, o.x, o.y, os.w, os.d);
      if (oc && oc.indexOf(idx) !== -1) return false;
    }
  }
  return true;
}

/** Like canPlace but skips door-approach clearance — for manual fine moves. */
/**
 * Manual-move validity (drag, arrow keys, nudge pad).
 *
 * Deliberately ignores the door-approach clearance and the 0.25 m placement
 * grid: those exist to make the AI's layout look right, but a person moving a
 * piece by hand should not be blocked by them. Walls and other furniture are
 * still enforced via the room polygon, which is also what keeps the door zone
 * itself navigable.
 */
export function canPlaceManual(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  x: number,
  y: number,
  rot: number,
  excludeUid?: string,
): boolean {
  return canPlaceRaw(grid, poly, items, byId, item, x, y, rot, excludeUid);
}

/**
 * Minimal checks for drag — no door clearance, no grid snap, just walls +
 * collision. Used by tryMoveRaw so dragging feels free while still refusing
 * to drop furniture through a wall or inside another piece.
 */
export function canPlaceRaw(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  x: number,
  y: number,
  rot: number,
  excludeUid?: string,
): boolean {
  if (item.mount === 'wall') {
    return rotRectInsidePoly(poly, x, y, item.w, item.d, rot);
  }
  if (item.mount === 'ceiling') {
    return rotRectInsidePoly(poly, x, y, item.w, item.d, rot);
  }
  if (item.mount === 'surface') {
    if (supportAt(items, byId, x, y) != null) {
      return rotRectInsidePoly(poly, x, y, item.w, item.d, rot);
    }
  }
  // Rotated footprint must sit wholly inside the room. `rot` must be passed:
  // omitting it makes every corner NaN and the test always fails.
  const { w, d } = rotatedSize(item.w, item.d, rot);
  if (!rotRectInsidePoly(poly, x, y, w, d, rot)) return false;

  // Footprint must stay within the grid's extent (rectCells is null when it
  // pokes outside); the grid is not consulted for free/blocked because the
  // door-approach zone is deliberately ignored during manual moves.
  if (!rectCells(grid, x, y, w, d)) return false;

  if (isFlat(item)) return true;
  for (const o of items) {
    if (o.uid === excludeUid) continue;
    const f = byId.get(o.itemId);
    if (!f || isFlat(f) || !blocksFloor(f) || overlapsAllowed(item, f)) continue;
    const os = rotatedSize(f.w, f.d, o.rot);
    const dx = Math.abs(x - o.x);
    const dy = Math.abs(y - o.y);
    if (dx < (w + os.w) / 2 && dy < (d + os.d) / 2) return false;
  }
  return true;
}

interface ScoreCtx {
  centroid: Vec2;
  maxD: number;
  doorPts: Vec2[];
}

function buildScoreCtx(poly: Vec2[], edges: EdgeInfo[]): ScoreCtx {
  const centroid = polyCentroid(poly);
  let maxD = 1;
  for (const p of poly) {
    const dd = Math.hypot(p.x - centroid.x, p.y - centroid.y);
    if (dd > maxD) maxD = dd;
  }
  const doorPts = edges
    .filter((e) => e.kind === 'door')
    .flatMap((e) => [e.a, e.b, { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }]);
  return { centroid, maxD, doorPts };
}

function scoreAt(ctx: ScoreCtx, poly: Vec2[], x: number, y: number, prefs: PlacePrefs): number {
  // wall proximity (0 = touching a wall, 1 = >1.2 m away)
  let wallD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const dd = distPointSeg({ x, y }, poly[j], poly[i]);
    if (dd < wallD) wallD = dd;
  }
  const wallScore = clamp01(1 - wallD / 1.2);
  const centerScore = clamp01(1 - Math.hypot(x - ctx.centroid.x, y - ctx.centroid.y) / ctx.maxD);
  let doorScore = 0;
  if (ctx.doorPts.length) {
    let dd = Infinity;
    for (const p of ctx.doorPts) {
      const d2 = Math.hypot(x - p.x, y - p.y);
      if (d2 < dd) dd = d2;
    }
    doorScore = clamp01(1 - dd / 2.0);
  }
  return wallScore * prefs.wall + centerScore * prefs.center + doorScore * prefs.door;
}

/** Unit normal of an edge pointing into the polygon. */
function inwardNormal(poly: Vec2[], a: Vec2, b: Vec2): Vec2 | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const n1 = { x: -dy / len, y: dx / len };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (pointInPoly({ x: mid.x + n1.x * 0.1, y: mid.y + n1.y * 0.1 }, poly)) return n1;
  return { x: -n1.x, y: -n1.y };
}

function doorClearance(edges: EdgeInfo[], x: number, y: number): number {
  let d = Infinity;
  for (const e of edges) {
    if (e.kind !== 'door') continue;
    d = Math.min(d, distPointSeg({ x, y }, e.a, e.b));
  }
  return d;
}

/** Best placement for an item on one specific wall edge (null when it can't fit). */
function sampleEdge(
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  edges: EdgeInfo[],
  idx: number,
): Spot | null {
  const e = edges[idx];
  if (!e || e.kind === 'door') return null;
  const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
  if (len < item.w + 0.05) return null;
  const inward = inwardNormal(poly, e.a, e.b);
  if (!inward) return null;
  const ux = (e.b.x - e.a.x) / len;
  const uy = (e.b.y - e.a.y) / len;
  const rot = normDeg((Math.atan2(-inward.x, inward.y) * 180) / Math.PI);
  const inset = item.d / 2 + 0.06;
  const prefs = PREFS[item.type];
  const wantsWindow = !!item.spec.windowPref;
  const others = items.filter((o) => byId.get(o.itemId)?.mount === 'wall');

  let best: Spot | null = null;
  let bestScore = -Infinity;
  const step = 0.25;
  const tEnd = len - item.w / 2;
  for (let t = item.w / 2; t <= tEnd + 1e-6; t += step) {
    const px = e.a.x + ux * t + inward.x * inset;
    const py = e.a.y + uy * t + inward.y * inset;
    if (!pointInPoly({ x: px, y: py }, poly)) continue;
    let clash = false;
    for (const o of others) {
      const of = byId.get(o.itemId)!;
      if (Math.hypot(o.x - px, o.y - py) < ((item.w + of.w) / 2) * 0.85) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    let s = len * 0.15 + (1 - Math.abs(t - len / 2) / (len / 2 + 1e-6)) * 0.6;
    if (e.kind === 'window') s += wantsWindow ? 2.5 : -0.5;
    else if (wantsWindow) s -= 1.0;
    const dd = doorClearance(edges, px, py);
    if (dd < 2) s += prefs.door * clamp01(1 - dd / 2);
    s += Math.random() * 0.06;
    if (s > bestScore) {
      bestScore = s;
      best = { x: px, y: py, rot };
    }
  }
  return best;
}

/** Find the best wall span for a wall-mounted piece. */
function findWallSpot(
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  edges: EdgeInfo[],
): Spot | null {
  const wantsWindow = !!item.spec.windowPref;
  let best: Spot | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < edges.length; i++) {
    const spot = sampleEdge(poly, items, byId, item, edges, i);
    if (!spot) continue;
    const e = edges[i];
    const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
    let s = len * 0.1;
    if (e.kind === 'window') s += wantsWindow ? 3 : -0.6;
    else if (wantsWindow) s -= 1.2;
    const dd = doorClearance(edges, spot.x, spot.y);
    if (dd < 2) s += PREFS[item.type].door * clamp01(1 - dd / 2);
    s += Math.random() * 0.05;
    if (s > bestScore) {
      bestScore = s;
      best = spot;
    }
  }
  return best;
}

/** Move a wall item onto the next wall that fits (used by Rotate on wall pieces). */
export function nextWallSpot(
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  edges: EdgeInfo[],
  fromX: number,
  fromY: number,
): Spot | null {
  let cur = 0;
  let curD = Infinity;
  for (let i = 0; i < edges.length; i++) {
    const dd = distPointSeg({ x: fromX, y: fromY }, edges[i].a, edges[i].b);
    if (dd < curD) {
      curD = dd;
      cur = i;
    }
  }
  for (let k = 1; k <= edges.length; k++) {
    const idx = (cur + k) % edges.length;
    if (edges[idx].kind === 'door') continue;
    const spot = sampleEdge(poly, items, byId, item, edges, idx);
    if (spot) return spot;
  }
  return null;
}

/** Project a dragged wall item onto its nearest non-door wall. */
export function projectToWall(
  poly: Vec2[],
  edges: EdgeInfo[],
  item: FurnItem,
  x: number,
  y: number,
): Spot | null {
  let best: Spot | null = null;
  let bestD = Infinity;
  for (const e of edges) {
    if (e.kind === 'door') continue;
    const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
    if (len < item.w + 0.02) continue;
    const inward = inwardNormal(poly, e.a, e.b);
    if (!inward) continue;
    const ux = (e.b.x - e.a.x) / len;
    const uy = (e.b.y - e.a.y) / len;
    let t = (x - e.a.x) * ux + (y - e.a.y) * uy;
    t = Math.min(Math.max(t, item.w / 2), len - item.w / 2);
    const px = e.a.x + ux * t + inward.x * (item.d / 2 + 0.06);
    const py = e.a.y + uy * t + inward.y * (item.d / 2 + 0.06);
    const dd = Math.hypot(px - x, py - y);
    if (dd < bestD) {
      bestD = dd;
      best = { x: px, y: py, rot: normDeg((Math.atan2(-inward.x, inward.y) * 180) / Math.PI) };
    }
  }
  return best;
}

/** Ceiling pieces hang over a table when there is one, otherwise over the room centre. */
function findCeilingSpot(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
): Spot | null {
  const centroid = polyCentroid(poly);
  const tables = items
    .filter((o) => {
      const f = byId.get(o.itemId);
      return f && f.mount === 'floor' && f.type === 'tables';
    })
    .sort(
      (a, b) =>
        Math.hypot(a.x - centroid.x, a.y - centroid.y) -
        Math.hypot(b.x - centroid.x, b.y - centroid.y),
    );
  const occ = items.filter((o) => byId.get(o.itemId)?.mount === 'ceiling');
  const free = (x: number, y: number) =>
    !occ.some((o) => {
      const of = byId.get(o.itemId)!;
      return Math.hypot(o.x - x, o.y - y) < ((of.w + item.w) / 2) * 0.8;
    });
  const tryPt = (x: number, y: number): Spot | null => {
    const sx = Math.round(x / 0.25) * 0.25;
    const sy = Math.round(y / 0.25) * 0.25;
    if (!rotRectInsidePoly(poly, sx, sy, item.w, item.d, 0)) return null;
    if (!free(sx, sy)) return null;
    return { x: sx, y: sy, rot: 0 };
  };
  for (const t of tables) {
    const spot = tryPt(t.x, t.y);
    if (spot) return spot;
  }
  const centreSpot = tryPt(centroid.x, centroid.y);
  if (centreSpot) return centreSpot;
  // last resort: the free cell centre closest to the room centroid
  // (first-fit would drop pendants into the far corner).
  let best: Spot | null = null;
  let bestD = Infinity;
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      if (grid.free[i + j * grid.cols] !== 1) continue;
      const x = grid.ox + (i + 0.5) * grid.cell;
      const y = grid.oy + (j + 0.5) * grid.cell;
      if (!rotRectInsidePoly(poly, x, y, item.w, item.d, 0)) continue;
      if (!free(x, y)) continue;
      const dd = Math.hypot(x - centroid.x, y - centroid.y);
      if (dd < bestD) {
        bestD = dd;
        best = { x, y, rot: 0 };
      }
    }
  }
  return best;
}

const SURFACE_PRIO: Record<string, number> = { tables: 3, storage: 2, beds: 1.2, seating: 1 };
const SPREAD: [number, number][] = [
  [0, 0],
  [0.26, 0],
  [-0.26, 0],
  [0, 0.26],
  [0, -0.26],
  [0.19, 0.19],
  [-0.19, -0.19],
  [0.19, -0.19],
  [-0.19, 0.19],
];

/** Tabletop pieces pick the best table top (and a free spot on it). */
function findSurfaceSpot(
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
): Spot | null {
  let best: Spot | null = null;
  let bestScore = -Infinity;
  for (const it of items) {
    const f = byId.get(it.itemId);
    if (!f) continue;
    const top = supportTop(f);
    if (top == null) continue;
    const used = items.filter((o) => {
      if (o.uid === it.uid) return false;
      const of = byId.get(o.itemId);
      if (!of || of.mount !== 'surface') return false;
      const r = (it.rot * Math.PI) / 180;
      const dx = o.x - it.x;
      const dy = o.y - it.y;
      const lx = dx * Math.cos(r) + dy * Math.sin(r);
      const ly = -dx * Math.sin(r) + dy * Math.cos(r);
      return Math.abs(lx) <= f.w / 2 + 0.03 && Math.abs(ly) <= f.d / 2 + 0.03;
    }).length;
    const maxX = Math.max(0, f.w / 2 - item.w / 2 - 0.03);
    const maxY = Math.max(0, f.d / 2 - item.d / 2 - 0.03);
    for (let k = used; k < used + SPREAD.length; k++) {
      const [ox, oy] = SPREAD[k % SPREAD.length];
      const cx = Math.min(Math.max(ox, -maxX), maxX);
      const cy = Math.min(Math.max(oy, -maxY), maxY);
      const r = (it.rot * Math.PI) / 180;
      const wx = it.x + cx * Math.cos(r) - cy * Math.sin(r);
      const wy = it.y + cx * Math.sin(r) + cy * Math.cos(r);
      // don't stack on another surface piece
      let clash = false;
      for (const o of items) {
        const of = byId.get(o.itemId);
        if (!of || of.mount !== 'surface') continue;
        if (Math.hypot(o.x - wx, o.y - wy) < Math.min(of.w, item.w) * 0.6) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      const s =
        (SURFACE_PRIO[f.type] ?? 1) + (k === used && used === 0 ? 0.4 : 0) + Math.random() * 0.1;
      if (s > bestScore) {
        bestScore = s;
        best = { x: wx, y: wy, rot: it.rot };
      }
      break; // first free slot on this support is enough
    }
  }
  return best;
}

/** Grid-based placement for floor items (and surface items with no table under them). */
function findFloorSpot(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  edges: EdgeInfo[],
  opts?: { rotations?: number[] },
): Spot | null {
  const prefs = PREFS[item.type];
  const ctx = buildScoreCtx(poly, edges);
  const occ = occupiedCells(grid, items, byId);
  const rotations = opts?.rotations ?? [0, 90];
  const flat = isFlat(item);
  let best: Spot | null = null;
  let bestScore = -Infinity;

  for (const rot of rotations) {
    const { w, d } = rotatedSize(item.w, item.d, rot);
    const n = Math.ceil(w / grid.cell - 1e-9);
    const m = Math.ceil(d / grid.cell - 1e-9);
    if (n > grid.cols || m > grid.rows) continue;
    for (let j0 = 0; j0 + m <= grid.rows; j0++) {
      for (let i0 = 0; i0 + n <= grid.cols; i0++) {
        const x = grid.ox + (i0 + n / 2) * grid.cell;
        const y = grid.oy + (j0 + m / 2) * grid.cell;
        // all spanned cells must be inside the room
        let ok = true;
        for (let j = j0; j < j0 + m && ok; j++) {
          for (let i = i0; i < i0 + n; i++) {
            if (grid.free[i + j * grid.cols] !== 1) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) continue;
        // no furniture overlap (flat textiles may sit under anything)
        if (!flat) {
          for (let j = j0; j < j0 + m && ok; j++) {
            for (let i = i0; i < i0 + n; i++) {
              if (occ.has(i + j * grid.cols)) {
                ok = false;
                break;
              }
            }
          }
          if (!ok) continue;
        }
        let s = scoreAt(ctx, poly, x, y, prefs);
        if (rot !== 0) s -= 0.03; // slight preference for native orientation
        // R36/R49/R147 — beds and tall pieces keep clear of window walls.
        if (item.type === 'beds' || (item.mount === 'floor' && item.h >= CLEARANCE.tallItemH)) {
          const wg = rectGapToEdges(edges, x, y, w, d, 'window');
          if (wg < CLEARANCE.windowClear) s -= 1.2;
        }
        // R6/R29/R34 — float seating off the walls in rooms big enough for it.
        if (item.type === 'seating' && polyArea(poly) >= CLEARANCE.floatMinArea) {
          const gap = rectGapToPoly(poly, x, y, w, d);
          if (gap < 0.04) s -= 0.3; // pushed flush against a wall
          else if (gap <= CLEARANCE.floatMax) s += 0.25; // floated, still near a wall
        }
        s += Math.random() * 0.04;
        if (s > bestScore) {
          bestScore = s;
          best = { x, y, rot };
        }
      }
    }
  }
  return best;
}

/**
 * Find the best spot for an item — dispatches on its mount type.
 * `edges` are the room's polygon edges with their kind (wall/window/door).
 * Returns null when nothing fits.
 */
export function findBestSpot(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  edges: EdgeInfo[],
  opts?: { rotations?: number[] },
): Spot | null {
  switch (item.mount) {
    case 'wall':
      return findWallSpot(poly, items, byId, item, edges);
    case 'ceiling':
      return findCeilingSpot(grid, poly, items, byId, item);
    case 'surface':
      return findSurfaceSpot(poly, items, byId, item) ?? findFloorSpot(grid, poly, items, byId, item, edges, opts);
    default:
      return findFloorSpot(grid, poly, items, byId, item, edges, opts);
  }
}

// ---------------------------------------------------------------------------
// Layout refinement — relational design rules applied after initial placement
// ---------------------------------------------------------------------------

/** Unit direction of an item's front (local +z) in 2D for a given rotation. */
function frontDir(rot: number): Vec2 {
  const r = (rot * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}

/** Snap a desired front direction to the nearest of the four 90° rotations. */
function snapRot(desiredFront: Vec2): number {
  let best = 0;
  let bestDot = -Infinity;
  for (const rot of [0, 90, 180, 270]) {
    const d = frontDir(rot);
    const dot = d.x * desiredFront.x + d.y * desiredFront.y;
    if (dot > bestDot) {
      bestDot = dot;
      best = rot;
    }
  }
  return best;
}

function norm2(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-9 ? { x: 0, y: 1 } : { x: v.x / l, y: v.y / l };
}

/**
 * Smallest gap between an axis-aligned rect (centre x,y, size w×d) and the
 * polygon's edges. Negative when the rect overlaps an edge.
 */
function rectGapToPoly(poly: Vec2[], x: number, y: number, w: number, d: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const half = (w * Math.abs(nx) + d * Math.abs(ny)) / 2;
    const dd = distPointSeg({ x, y }, a, b) - half;
    if (dd < best) best = dd;
  }
  return best;
}

/** Smallest gap between an axis-aligned rect and edges of a given kind. */
function rectGapToEdges(edges: EdgeInfo[], x: number, y: number, w: number, d: number, kind: EdgeKind): number {
  let best = Infinity;
  for (const e of edges) {
    if (e.kind !== kind) continue;
    const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
    if (len < 1e-9) continue;
    const nx = -(e.b.y - e.a.y) / len;
    const ny = (e.b.x - e.a.x) / len;
    const half = (w * Math.abs(nx) + d * Math.abs(ny)) / 2;
    const dd = distPointSeg({ x, y }, e.a, e.b) - half;
    if (dd < best) best = dd;
  }
  return best;
}

/** Nearest edge to a point (optionally skipping one kind, e.g. windows). */
function nearestEdge(edges: EdgeInfo[], x: number, y: number, skipKind?: EdgeKind): EdgeInfo | null {
  let best: EdgeInfo | null = null;
  let bestD = Infinity;
  for (const e of edges) {
    if (skipKind && e.kind === skipKind) continue;
    const dd = distPointSeg({ x, y }, e.a, e.b);
    if (dd < bestD) {
      bestD = dd;
      best = e;
    }
  }
  return best;
}

/** Exact AABB overlap test for 90°-multiple placements (2 cm slack). */
function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ad: number,
  bx: number,
  by: number,
  bw: number,
  bd: number,
): boolean {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 - 0.02 &&
    Math.abs(ay - by) < (ad + bd) / 2 - 0.02
  );
}

/** Grid cells free + footprint fully inside the polygon (no occupancy check). */
function cellsFree(grid: Grid, poly: Vec2[], item: FurnItem, x: number, y: number, rot: number): boolean {
  const { w, d } = rotatedSize(item.w, item.d, rot);
  const cells = rectCells(grid, x, y, w, d);
  if (!cells) return false;
  for (const idx of cells) if (grid.free[idx] !== 1) return false;
  return rotRectInsidePoly(poly, x, y, w, d, rot);
}

/**
 * cellsFree plus an exact rect-overlap check against every other blocking
 * item. Unlike canPlace's cell-based occupancy this allows two pieces to
 * share a grid cell when their footprints don't actually touch — required
 * for the 5–15 cm nightstand gap and chair nudges.
 */
function strictFit(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  item: FurnItem,
  x: number,
  y: number,
  rot: number,
  excludeUid?: string,
  opts?: { skipOverlap?: boolean },
): boolean {
  if (!cellsFree(grid, poly, item, x, y, rot)) return false;
  if (opts?.skipOverlap) return true;
  const { w, d } = rotatedSize(item.w, item.d, rot);
  for (const o of items) {
    if (o.uid === excludeUid) continue;
    const f = byId.get(o.itemId);
    if (!f || !blocksFloor(f)) continue;
    const os = rotatedSize(f.w, f.d, o.rot);
    if (rectsOverlap(x, y, w, d, o.x, o.y, os.w, os.d)) return false;
  }
  return true;
}

/**
 * Post-placement pass applying the relational design rules:
 *  - sofa/bed backs against the nearest wall (R48, R33)
 *  - coffee table 35–45 cm in front of the sofa, centred on it (R21)
 *  - accent chairs face the sofa, within conversation distance (R9/R26/R35)
 *  - nightstands flank the bed head with a 5–15 cm gap (R45/R60)
 *  - artwork hangs on the wall behind the sofa (R145)
 *  - rugs anchor the seating group, or sit beside the bed (R13/R55)
 * Mutates `items` in place; every move is validated before it is kept.
 */
export function refineLayout(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
): void {
  const sofa = items.find((it) => byId.get(it.itemId)?.kind === 'sofa');
  const bed = items.find((it) => byId.get(it.itemId)?.type === 'beds');
  const vanity = items.find((it) => byId.get(it.itemId)?.type === 'vanity');
  const toilet = items.find((it) => byId.get(it.itemId)?.type === 'toilet');
  const shower = items.find((it) => byId.get(it.itemId)?.type === 'shower');
  const tub = items.find((it) => byId.get(it.itemId)?.type === 'bathtub');

  orientPrimarySeating(grid, poly, items, byId, edges, sofa, bed);
  relateCoffeeToSofa(grid, poly, items, byId, sofa);
  faceSeating(grid, poly, items, byId, sofa);
  seatChairAtDesk(grid, poly, items, byId);
  centerPendantOverTable(poly, items, byId);
  flankBedNightstands(grid, poly, items, byId, bed);
  hangArtOverSofa(poly, items, byId, edges, sofa);
  anchorRug(grid, poly, items, byId, sofa, bed);

  // Bathroom geometry — fixtures hug their wall, the toilet gets its side and
  // front clearances (R84/R85), the shower takes a corner, the mirror centres
  // over the vanity and the towel rack lands within reach of it.
  orientFixtureToWall(grid, poly, items, byId, edges, vanity);
  orientFixtureToWall(grid, poly, items, byId, edges, toilet, true); // R95 — privacy at windows
  orientFixtureToWall(grid, poly, items, byId, edges, shower);
  orientFixtureToWall(grid, poly, items, byId, edges, tub);
  spaceToilet(grid, poly, items, byId, edges);
  tuckShowerIntoCorner(grid, poly, items, byId, edges);
  mirrorOverVanity(poly, items, byId, edges);
  towelRackByFixture(poly, items, byId, edges);
}

// ---------------------------------------------------------------------------
// Bathroom passes
// ---------------------------------------------------------------------------

/** Nearest edge a fixture can mount against (doors never; windows optionally). */
function fixtureWall(edges: EdgeInfo[], x: number, y: number, skipWindow?: boolean): EdgeInfo | null {
  let best: EdgeInfo | null = null;
  let bd = Infinity;
  for (const e of edges) {
    if (e.kind === 'door' || (skipWindow && e.kind === 'window')) continue;
    const dd = distPointSeg({ x, y }, e.a, e.b);
    if (dd < bd) {
      bd = dd;
      best = e;
    }
  }
  return best;
}

/** Closest point on a segment — used to classify edges as side vs front. */
function closestOnSeg(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = clamp01(t);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Gap from an axis-aligned rect to one specific edge (negative = overlap). */
function rectGapToEdge(x: number, y: number, w: number, d: number, e: EdgeInfo): number {
  const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
  if (len < 1e-9) return Infinity;
  const nx = -(e.b.y - e.a.y) / len;
  const ny = (e.b.x - e.a.x) / len;
  const half = (w * Math.abs(nx) + d * Math.abs(ny)) / 2;
  return distPointSeg({ x, y }, e.a, e.b) - half;
}

/**
 * Turn a bathroom fixture so its back faces the nearest wall and slide it
 * flush against that wall — vanities, toilets, showers and tubs all read as
 * wall-mounted pieces, wherever the initial grid scan happened to leave them.
 */
function orientFixtureToWall(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
  it?: PlacedItem,
  skipWindow?: boolean,
): void {
  if (!it) return;
  const f = byId.get(it.itemId);
  if (!f) return;
  const wall = fixtureWall(edges, it.x, it.y, skipWindow);
  if (!wall) return;
  const inward = inwardNormal(poly, wall.a, wall.b);
  if (!inward) return;
  const cur = rotatedSize(f.w, f.d, it.rot);
  const nearD = distPointSeg({ x: it.x, y: it.y }, wall.a, wall.b);
  const curGap = nearD - (cur.w * Math.abs(inward.x) + cur.d * Math.abs(inward.y)) / 2;
  if (curGap > 0.6) return; // floating mid-room: leave it alone

  const rot = snapRot(inward); // back (−z) lands on the wall, front opens into the room
  const { w: tw, d: td } = rotatedSize(f.w, f.d, rot);
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (len < 1e-6) return;
  const ux = (wall.b.x - wall.a.x) / len;
  const uy = (wall.b.y - wall.a.y) / len;
  const along = tw * Math.abs(ux) + td * Math.abs(uy);
  let t = (it.x - wall.a.x) * ux + (it.y - wall.a.y) * uy;
  t = Math.min(Math.max(t, along / 2), Math.max(len - along / 2, along / 2));
  const inset = (tw * Math.abs(inward.x) + td * Math.abs(inward.y)) / 2 + 0.02;
  const nx = wall.a.x + ux * t + inward.x * inset;
  const ny = wall.a.y + uy * t + inward.y * inset;
  if (strictFit(grid, poly, items, byId, f, nx, ny, rot, it.uid)) {
    it.x = nx;
    it.y = ny;
    it.rot = rot;
    return;
  }
  // Flush is impossible (blocked) — rotate in place if that still fits.
  if (rot !== it.rot && canPlace(grid, poly, items, byId, f, it.x, it.y, rot, it.uid)) {
    it.rot = rot;
  }
}

/**
 * R84/R85 — slide the toilet along its wall toward the spot with the widest
 * side clearances (40 cm) and the deepest front clearance (53 cm).
 */
function spaceToilet(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
): void {
  const toilet = items.find((it) => byId.get(it.itemId)?.type === 'toilet');
  if (!toilet) return;
  const tf = byId.get(toilet.itemId);
  if (!tf) return;
  let wall: EdgeInfo | null = null;
  let wd = Infinity;
  for (const e of edges) {
    if (e.kind !== 'wall') continue;
    const dd = distPointSeg({ x: toilet.x, y: toilet.y }, e.a, e.b);
    if (dd < wd) {
      wd = dd;
      wall = e;
    }
  }
  if (!wall) return;
  const { w, d } = rotatedSize(tf.w, tf.d, toilet.rot);
  if (rectGapToEdge(toilet.x, toilet.y, w, d, wall) > 0.12) return; // not mounted
  const inward = inwardNormal(poly, wall.a, wall.b);
  if (!inward) return;
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (len < w + 0.05) return;
  const ux = (wall.b.x - wall.a.x) / len;
  const uy = (wall.b.y - wall.a.y) / len;
  const inset = wd; // keep the current distance from the wall
  const fd = frontDir(toilet.rot);

  const score = (x: number, y: number): number => {
    let side = Infinity;
    let front = Infinity;
    for (const e of edges) {
      if (e === wall) continue;
      const gap = rectGapToEdge(x, y, w, d, e);
      if (gap < 0) return -1; // straddles another wall
      const cp = closestOnSeg({ x, y }, e.a, e.b);
      const vx = cp.x - x;
      const vy = cp.y - y;
      const l = Math.hypot(vx, vy) || 1;
      if ((vx * fd.x + vy * fd.y) / l > 0.5) front = Math.min(front, gap);
      else side = Math.min(side, gap);
    }
    if (side === Infinity || front === Infinity) return -1;
    return (
      (side >= CLEARANCE.toiletSide ? 1 : side / CLEARANCE.toiletSide) +
      (front >= CLEARANCE.toiletFront ? 1 : front / CLEARANCE.toiletFront)
    );
  };

  let bx = toilet.x;
  let by = toilet.y;
  let bs = score(bx, by);
  for (let t = w / 2; t <= len - w / 2 + 1e-6; t += 0.1) {
    const x = wall.a.x + ux * t + inward.x * inset;
    const y = wall.a.y + uy * t + inward.y * inset;
    if (!strictFit(grid, poly, items, byId, tf, x, y, toilet.rot, toilet.uid)) continue;
    const s = score(x, y);
    if (s > bs + 0.02) {
      bs = s;
      bx = x;
      by = y;
    }
  }
  toilet.x = bx;
  toilet.y = by;
}

/**
 * Exact-geometry fit test for a corner candidate. The 0.5 m placement grid is
 * too coarse here: cells that overrun the room's bounding box are marked
 * blocked, so every candidate flush to the right/top walls would be rejected
 * even though the rect sits perfectly inside the room.
 * Returns null when the candidate fits, else a short reject reason.
 */
function cornerFit(
  poly: Vec2[],
  edges: EdgeInfo[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  x: number,
  y: number,
  w: number,
  d: number,
  excludeUid: string,
): string | null {
  if (!rotRectInsidePoly(poly, x, y, w, d, 0)) return 'outside';
  for (const e of edges) {
    const gap = rectGapToEdge(x, y, w, d, e);
    if (e.kind === 'door') {
      if (gap < CLEARANCE.doorApproach) return 'door'; // keep the swing clear
      continue;
    }
    // Built partition walls live strictly inside the room outline.
    const mx = (e.a.x + e.b.x) / 2;
    const my = (e.a.y + e.b.y) / 2;
    if (rotRectInsidePoly(poly, mx, my, 0.01, 0.01, 0) && gap < 0.03) return 'wall';
  }
  for (const o of items) {
    if (o.uid === excludeUid) continue;
    const of = byId.get(o.itemId);
    if (!of || of.mount !== 'floor' || of.spec.rug) continue;
    const os = rotatedSize(of.w, of.d, o.rot);
    if (rectsOverlap(x, y, w, d, o.x, o.y, os.w, os.d)) return of.type;
  }
  return null;
}

/** The shower takes a room corner — flush to both walls that meet there. */
function tuckShowerIntoCorner(
  _grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
): void {
  const shower = items.find((it) => byId.get(it.itemId)?.type === 'shower');
  if (!shower) return;
  const sf = byId.get(shower.itemId);
  if (!sf) return;
  /** How many room edges the rect sits flush against — 2 means a corner. */
  const flushCount = (x: number, y: number, w: number, d: number): number => {
    let n = 0;
    for (const e of edges) if (rectGapToEdge(x, y, w, d, e) < 0.06) n++;
    return n;
  };
  const cur = rotatedSize(sf.w, sf.d, shower.rot);
  if (flushCount(shower.x, shower.y, cur.w, cur.d) >= 2) return; // already tucked
  const c = polyCentroid(poly);
  let best: { x: number; y: number; rot: number } | null = null;
  let bestDist = Infinity;
  const quads: Array<[number, number]> = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const v of poly) {
    const dir = norm2({ x: c.x - v.x, y: c.y - v.y });
    const rot = snapRot(dir); // door/front opens toward the room centre
    const { w, d } = rotatedSize(sf.w, sf.d, rot);
    for (const [sx, sy] of quads) {
      // Inset 2 cm from both walls — boundary-exact rects fail the inside-poly
      // check, the same margin orientFixtureToWall uses.
      const x = v.x + sx * (w / 2 + 0.02);
      const y = v.y + sy * (d / 2 + 0.02);
      if (flushCount(x, y, w, d) < 2) continue; // must meet two walls
      if (cornerFit(poly, edges, items, byId, x, y, w, d, shower.uid)) continue;
      const dist = Math.hypot(x - shower.x, y - shower.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x, y, rot };
      }
    }
  }
  if (best) {
    shower.x = best.x;
    shower.y = best.y;
    shower.rot = best.rot;
  }
}

/** The vanity mirror centres itself on the wall behind the vanity. */
function mirrorOverVanity(
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
): void {
  const vanity = items.find((it) => byId.get(it.itemId)?.type === 'vanity');
  const mirror = items.find((it) => byId.get(it.itemId)?.type === 'vamirror');
  if (!vanity || !mirror) return;
  const vf = byId.get(vanity.itemId);
  const mf = byId.get(mirror.itemId);
  if (!vf || !mf) return;
  const wall = fixtureWall(edges, vanity.x, vanity.y);
  if (!wall || wall.kind !== 'wall') return; // never over a door or window
  const inward = inwardNormal(poly, wall.a, wall.b);
  if (!inward) return;
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (len < mf.w + 0.05) return;
  const ux = (wall.b.x - wall.a.x) / len;
  const uy = (wall.b.y - wall.a.y) / len;
  let t = (vanity.x - wall.a.x) * ux + (vanity.y - wall.a.y) * uy;
  t = Math.min(Math.max(t, mf.w / 2), len - mf.w / 2);
  const inset = mf.d / 2 + 0.06;
  const x = wall.a.x + ux * t + inward.x * inset;
  const y = wall.a.y + uy * t + inward.y * inset;
  const rot = normDeg((Math.atan2(-inward.x, inward.y) * 180) / Math.PI);
  for (const o of items) {
    if (o.uid === mirror.uid) continue;
    const of = byId.get(o.itemId);
    if (!of || of.mount !== 'wall') continue;
    if (Math.hypot(o.x - x, o.y - y) < ((mf.w + of.w) / 2) * 0.85) return;
  }
  if (!rotRectInsidePoly(poly, x, y, mf.w, mf.d, rot)) return;
  mirror.x = x;
  mirror.y = y;
  mirror.rot = rot;
}

/** The towel rack lands on the same wall, within arm's reach of vanity/tub. */
function towelRackByFixture(
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
): void {
  const rack = items.find((it) => byId.get(it.itemId)?.type === 'towelrack');
  if (!rack) return;
  const rf = byId.get(rack.itemId);
  if (!rf) return;
  const anchor = items.find((it) => {
    const t = byId.get(it.itemId)?.type;
    return t === 'vanity' || t === 'bathtub';
  });
  if (!anchor) return;
  const af = byId.get(anchor.itemId);
  if (!af) return;
  const wall = fixtureWall(edges, anchor.x, anchor.y);
  if (!wall || wall.kind !== 'wall') return;
  const inward = inwardNormal(poly, wall.a, wall.b);
  if (!inward) return;
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (len < rf.w + 0.05) return;
  const ux = (wall.b.x - wall.a.x) / len;
  const uy = (wall.b.y - wall.a.y) / len;
  const rot = normDeg((Math.atan2(-inward.x, inward.y) * 180) / Math.PI);
  const inset = rf.d / 2 + 0.06;
  const tA = (anchor.x - wall.a.x) * ux + (anchor.y - wall.a.y) * uy;
  const reach = af.w / 2 + rf.w / 2 + 0.15;
  for (const s of [1, -1]) {
    const t = tA + s * reach;
    if (t < rf.w / 2 || t > len - rf.w / 2) continue;
    const x = wall.a.x + ux * t + inward.x * inset;
    const y = wall.a.y + uy * t + inward.y * inset;
    let clash = false;
    for (const o of items) {
      if (o.uid === rack.uid) continue;
      const of = byId.get(o.itemId);
      if (!of || of.mount !== 'wall') continue;
      if (Math.hypot(o.x - x, o.y - y) < ((rf.w + of.w) / 2) * 0.85) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    if (!rotRectInsidePoly(poly, x, y, rf.w, rf.d, rot)) continue;
    rack.x = x;
    rack.y = y;
    rack.rot = rot;
    return;
  }
}

/** Office chair sits in front of the desk, facing it (R113). */
function seatChairAtDesk(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
): void {
  const desk = items.find((it) => byId.get(it.itemId)?.kind === 'desk');
  const chair = items.find((it) => byId.get(it.itemId)?.kind === 'dining');
  if (!desk || !chair) return;
  const df = byId.get(desk.itemId);
  const cf = byId.get(chair.itemId);
  if (!df || !cf) return;
  const dir = frontDir(desk.rot);
  const { d: dd } = rotatedSize(df.w, df.d, desk.rot);
  const { d: cd } = rotatedSize(cf.w, cf.d, desk.rot);
  const x = desk.x + dir.x * (dd / 2 + cd / 2 + 0.05);
  const y = desk.y + dir.y * (dd / 2 + cd / 2 + 0.05);
  if (strictFit(grid, poly, items, byId, cf, x, y, desk.rot + 180, chair.uid)) {
    chair.x = x;
    chair.y = y;
    chair.rot = desk.rot + 180;
  }
}

/** Sofa and bed backs against the nearest wall (R48; R49 skips window walls). */
function orientPrimarySeating(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
  sofa?: PlacedItem,
  bed?: PlacedItem,
): void {
  const polyEdges = edges.slice(0, poly.length);
  const orient = (it: PlacedItem, skipWindow: boolean) => {
    const f = byId.get(it.itemId);
    if (!f) return;
    const near = nearestEdge(polyEdges, it.x, it.y, skipWindow ? 'window' : undefined);
    if (!near) return;
    const inward = inwardNormal(poly, near.a, near.b);
    if (!inward) return;
    const { w, d } = rotatedSize(f.w, f.d, it.rot);
    const nearD = distPointSeg({ x: it.x, y: it.y }, near.a, near.b);
    const gap = nearD - (w * Math.abs(inward.x) + d * Math.abs(inward.y)) / 2;
    if (gap > 0.6) return; // floating mid-room: leave the placed rotation
    const rot = snapRot(inward);
    if (rot === it.rot) return;
    if (canPlace(grid, poly, items, byId, f, it.x, it.y, rot, it.uid)) {
      it.rot = rot;
    }
  };
  if (sofa) orient(sofa, false);
  if (bed) orient(bed, true);
}

/** Coffee table 35–45 cm in front of the sofa, centred on its axis (R21). */
function relateCoffeeToSofa(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  sofa?: PlacedItem,
): void {
  if (!sofa) return;
  const sf = byId.get(sofa.itemId);
  const coffee = items.find((it) => byId.get(it.itemId)?.kind === 'coffee');
  if (!sf || !coffee) return;
  const cf = byId.get(coffee.itemId);
  if (!cf) return;
  const dir = frontDir(sofa.rot);
  const { w: sw, d: sd } = rotatedSize(sf.w, sf.d, sofa.rot);
  const { w: cw, d: cd } = rotatedSize(cf.w, cf.d, sofa.rot);
  for (const gap of [0.4, CLEARANCE.sofaCoffeeMin, CLEARANCE.sofaCoffeeMax]) {
    const x = sofa.x + dir.x * (sd / 2 + gap + cd / 2);
    const y = sofa.y + dir.y * (sd / 2 + gap + cd / 2);
    if (strictFit(grid, poly, items, byId, cf, x, y, sofa.rot, coffee.uid)) {
      coffee.x = x;
      coffee.y = y;
      coffee.rot = sofa.rot;
      return;
    }
  }
}

/** Chairs face the sofa (or the nearest table) and stay in conversation range. */
function faceSeating(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  sofa?: PlacedItem,
): void {
  for (const it of items) {
    const f = byId.get(it.itemId);
    if (!f || f.type !== 'seating') continue;
    if (sofa && it.uid === sofa.uid) continue;
    let ax = 0;
    let ay = 0;
    let hasAnchor = false;
    if (sofa) {
      ax = sofa.x;
      ay = sofa.y;
      hasAnchor = true;
    } else {
      let bestD = Infinity;
      for (const o of items) {
        const of = byId.get(o.itemId);
        if (!of || of.type !== 'tables') continue;
        const dd = Math.hypot(o.x - it.x, o.y - it.y);
        if (dd < bestD) {
          bestD = dd;
          ax = o.x;
          ay = o.y;
          hasAnchor = true;
        }
      }
    }
    if (!hasAnchor) continue;
    const dx = ax - it.x;
    const dy = ay - it.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) continue;
    const rot = snapRot(norm2({ x: dx, y: dy }));
    if (rot !== it.rot && canPlace(grid, poly, items, byId, f, it.x, it.y, rot, it.uid)) {
      it.rot = rot;
    }
    // R9/R26 — keep within conversation distance of the anchor.
    if (dist > CLEARANCE.conversationMax) {
      for (let k = 1; k <= 12; k++) {
        const t = k * 0.25;
        const x = it.x + (dx / dist) * t;
        const y = it.y + (dy / dist) * t;
        if (Math.hypot(ax - x, ay - y) > CLEARANCE.conversationMax) continue;
        if (strictFit(grid, poly, items, byId, f, x, y, it.rot, it.uid)) {
          it.x = x;
          it.y = y;
          break;
        }
      }
    }
  }
}

/** Pendant hangs over the coffee/dining table it lights (R105). */
function centerPendantOverTable(poly: Vec2[], items: PlacedItem[], byId: Map<string, FurnItem>): void {
  const pendant = items.find((it) => byId.get(it.itemId)?.kind === 'pendant');
  if (!pendant) return;
  const table = items.find((it) => {
    const f = byId.get(it.itemId);
    return f && f.type === 'tables' && (f.kind === 'coffee' || f.kind === 'dining');
  });
  if (!table) return;
  const pf = byId.get(pendant.itemId);
  if (!pf) return;
  const sx = Math.round(table.x / 0.25) * 0.25;
  const sy = Math.round(table.y / 0.25) * 0.25;
  if (!rotRectInsidePoly(poly, sx, sy, pf.w, pf.d, 0)) return;
  const occ = items.filter((o) => byId.get(o.itemId)?.mount === 'ceiling' && o.uid !== pendant.uid);
  const clash = occ.some((o) => {
    const of = byId.get(o.itemId)!;
    return Math.hypot(o.x - sx, o.y - sy) < ((of.w + pf.w) / 2) * 0.8;
  });
  if (clash) return;
  pendant.x = sx;
  pendant.y = sy;
}

/** Nightstands flank the bed head with a 5–15 cm gap (R45/R60). */
function flankBedNightstands(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  bed?: PlacedItem,
): void {
  if (!bed) return;
  const bf = byId.get(bed.itemId);
  if (!bf) return;
  const nights = items.filter((it) => byId.get(it.itemId)?.kind === 'nightstand');
  if (!nights.length) return;
  const { w: bw, d: bd } = rotatedSize(bf.w, bf.d, bed.rot);
  const r = (bed.rot * Math.PI) / 180;
  const side = { x: Math.cos(r), y: Math.sin(r) }; // bed local +x (lateral)
  const back = { x: -Math.sin(r), y: Math.cos(r) }; // bed local +y (head)
  const gap = (CLEARANCE.nightstandMin + CLEARANCE.nightstandMax) / 2;
  nights.forEach((ns, idx) => {
    const nf = byId.get(ns.itemId);
    if (!nf) return;
    const { w: nw, d: nd } = rotatedSize(nf.w, nf.d, bed.rot);
    const along = bd / 2 - nd / 2; // flush with the head end
    const lateral = bw / 2 + nw / 2 + gap;
    const sides = idx % 2 === 0 ? [1, -1] : [-1, 1];
    for (const s of sides) {
      const x = bed.x + back.x * along + side.x * lateral * s;
      const y = bed.y + back.y * along + side.y * lateral * s;
      if (strictFit(grid, poly, items, byId, nf, x, y, bed.rot, ns.uid)) {
        // carry any surface item (e.g. a bedside lamp) sitting on it
        for (const o of items) {
          if (o.uid === ns.uid) continue;
          const of = byId.get(o.itemId);
          if (!of || of.mount !== 'surface') continue;
          if (Math.hypot(o.x - ns.x, o.y - ns.y) < 0.3) {
            o.x += x - ns.x;
            o.y += y - ns.y;
          }
        }
        ns.x = x;
        ns.y = y;
        ns.rot = bed.rot;
        return;
      }
    }
  });
}

/** Artwork hangs on the wall behind the sofa (R145; gallery height is data). */
function hangArtOverSofa(
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  edges: EdgeInfo[],
  sofa?: PlacedItem,
): void {
  if (!sofa) return;
  const art = items.find((it) => byId.get(it.itemId)?.kind === 'artwork');
  if (!art) return;
  const af = byId.get(art.itemId);
  if (!af) return;
  const cands = edges
    .map((e) => ({ e, d: distPointSeg(sofa, e.a, e.b) }))
    .filter((c) => c.e.kind !== 'door' && c.d <= 1.6)
    .sort((a, b) => a.d - b.d);
  if (!cands.length) return;
  const best = cands[0];
  const solid = cands.find((c) => c.e.kind !== 'window');
  const chosen = solid && solid.d <= best.d + 0.6 ? solid : best;
  const e = chosen.e;
  const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
  if (len < af.w + 0.05) return;
  const inward = inwardNormal(poly, e.a, e.b);
  if (!inward) return;
  const ux = (e.b.x - e.a.x) / len;
  const uy = (e.b.y - e.a.y) / len;
  const rot = normDeg((Math.atan2(-inward.x, inward.y) * 180) / Math.PI);
  const inset = af.d / 2 + 0.06;
  const t0 = (sofa.x - e.a.x) * ux + (sofa.y - e.a.y) * uy;
  const others = items.filter((o) => byId.get(o.itemId)?.mount === 'wall' && o.uid !== art.uid);
  for (const off of [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1, -1, 1.5, -1.5, 2, -2]) {
    const tt = Math.min(Math.max(t0 + off, af.w / 2), len - af.w / 2);
    const px = e.a.x + ux * tt + inward.x * inset;
    const py = e.a.y + uy * tt + inward.y * inset;
    if (!pointInPoly({ x: px, y: py }, poly)) continue;
    let clash = false;
    for (const o of others) {
      const of = byId.get(o.itemId)!;
      if (Math.hypot(o.x - px, o.y - py) < ((af.w + of.w) / 2) * 0.85) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    art.x = px;
    art.y = py;
    art.rot = rot;
    return;
  }
}

/** Rugs anchor the seating group, or sit beside the bed (R13/R55). */
function anchorRug(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  sofa?: PlacedItem,
  bed?: PlacedItem,
): void {
  const rug = items.find((it) => {
    const f = byId.get(it.itemId);
    return f && isFlat(f);
  });
  if (!rug) return;
  const rf = byId.get(rug.itemId);
  if (!rf) return;

  if (bed) {
    // R55/R143 — beside the bed, sliding slightly under it.
    const bf = byId.get(bed.itemId);
    if (!bf) return;
    const r = (bed.rot * Math.PI) / 180;
    const side = { x: Math.cos(r), y: Math.sin(r) };
    const { w: bw } = rotatedSize(bf.w, bf.d, bed.rot);
    const { w: rw } = rotatedSize(rf.w, rf.d, bed.rot + 90);
    const lateral = bw / 2 + rw / 2 - CLEARANCE.rugUnderBed;
    for (const s of [1, -1]) {
      const x = bed.x + side.x * lateral * s;
      const y = bed.y + side.y * lateral * s;
      if (strictFit(grid, poly, items, byId, rf, x, y, bed.rot + 90, rug.uid, { skipOverlap: true })) {
        rug.x = x;
        rug.y = y;
        rug.rot = bed.rot + 90;
        return;
      }
    }
    return;
  }

  // R13/R141 — centred under the seating + tables group.
  const group = items.filter((it) => {
    const f = byId.get(it.itemId);
    return f && f.mount === 'floor' && !isFlat(f) && (f.type === 'seating' || f.type === 'tables');
  });
  if (!group.length) return;
  const cx = group.reduce((s, it) => s + it.x, 0) / group.length;
  const cy = group.reduce((s, it) => s + it.y, 0) / group.length;
  const anchor = sofa ?? group[0];
  const rot = anchor.rot;
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    const x = cx + (anchor.x - cx) * t;
    const y = cy + (anchor.y - cy) * t;
    if (strictFit(grid, poly, items, byId, rf, x, y, rot, rug.uid, { skipOverlap: true })) {
      rug.x = x;
      rug.y = y;
      rug.rot = rot;
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// AI fill presets
// ---------------------------------------------------------------------------

export interface PresetStep {
  type: FurnType;
  kind?: string;
  count?: number;
}

/**
 * What AI Fill puts in each kind of room, in placement order. Order matters:
 * the big anchoring pieces go down first so the smaller ones fit around them,
 * and `kind` only narrows the pool when the library actually has a match.
 */
export const PRESETS: Record<RoomKind, PresetStep[]> = {
  living: [
    { type: 'textiles', kind: 'arearug' },
    { type: 'seating', kind: 'sofa' },
    { type: 'tables', kind: 'coffee' },
    { type: 'seating', kind: 'accent', count: 2 },
    { type: 'floorlamp', kind: 'floor' },
    { type: 'ceilight', kind: 'pendant' },
    { type: 'floorplants', kind: 'monstera' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'functional', kind: 'basket' },
    { type: 'walllight' }, // R14/R139 — the accent layer
  ],
  bedroom: [
    { type: 'textiles', kind: 'arearug' },
    { type: 'beds' },
    { type: 'storage', kind: 'nightstand', count: 2 }, // R51 — both sides reachable
    { type: 'ceilight', kind: 'flush' },
    { type: 'floorlamp', kind: 'table' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'walllight' }, // R14/R139 — the accent layer
  ],
  office: [
    { type: 'textiles', kind: 'arearug' },
    { type: 'tables', kind: 'desk' },
    { type: 'seating', kind: 'dining' },
    { type: 'storage', kind: 'bookcase' },
    { type: 'ceilight', kind: 'flush' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'floorlamp', kind: 'desk' }, // R118/R148 — task light on the desk
  ],
  bathroom: [
    // Vanity first: it claims the best wall and becomes the mirror's anchor.
    { type: 'vanity' },
    { type: 'vamirror' }, // centred over the vanity (refine pass)
    { type: 'toilet' },
    { type: 'shower' },   // tucked into a corner (refine pass)
    { type: 'bathtub' },
    { type: 'towelrack' }, // beside the vanity / tub (refine pass)
    { type: 'floorplants', kind: 'fern' }, // humidity lovers
    { type: 'succulents' }, // on the vanity counter (surface mount)
  ],
  dining: [
    { type: 'tables', kind: 'dining' }, // anchors the room; chairs ring it
    { type: 'seating', kind: 'dining', count: 4 },
    { type: 'ceilight', kind: 'pendant', count: 2 }, // low over the table
    { type: 'tabletop', kind: 'vase' },
    { type: 'tabletop', kind: 'candle' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'floorplants', kind: 'ficus' },
  ],
  kitchen: [
    { type: 'tables', kind: 'table' },
    { type: 'seating', kind: 'dining', count: 2 },
    { type: 'storage', kind: 'sideboard' },
    { type: 'functional', kind: 'media' }, // the appliance run
    { type: 'ceilight', kind: 'flush' },
    { type: 'tabletop', kind: 'bowl' },
    { type: 'tabletop', kind: 'vase' },
  ],
  kids: [
    { type: 'beds' },
    { type: 'textiles', kind: 'arearug' },
    { type: 'seating', kind: 'floorcushion', count: 2 },
    { type: 'tables', kind: 'coffee' },
    { type: 'storage', kind: 'shelf' },
    { type: 'ceilight', kind: 'flush' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'functional', kind: 'basket', count: 2 }, // toy storage
  ],
  nursery: [
    { type: 'beds' }, // cot / daybed
    { type: 'textiles', kind: 'arearug' },
    { type: 'seating', kind: 'accent' }, // feeding chair
    { type: 'storage', kind: 'chest' },
    { type: 'ceilight', kind: 'flush' }, // dimmable, no glare
    { type: 'walldecor', kind: 'artwork' },
    { type: 'functional', kind: 'basket' },
    { type: 'walllight', kind: 'shade' },
  ],
  study: [
    { type: 'tables', kind: 'desk' },
    { type: 'seating', kind: 'dining' },
    { type: 'storage', kind: 'bookcase' },
    { type: 'textiles', kind: 'arearug' },
    { type: 'ceilight', kind: 'flush' },
    { type: 'walldecor', kind: 'picture' },
    { type: 'floorlamp', kind: 'desk' }, // R118/R148 — task light on the desk
  ],
  library: [
    { type: 'storage', kind: 'bookcase', count: 2 },
    { type: 'seating', kind: 'accent', count: 2 },
    { type: 'tables', kind: 'coffee' },
    { type: 'textiles', kind: 'arearug' },
    { type: 'floorlamp', kind: 'floor' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'tabletop', kind: 'books' },
  ],
  guest: [
    { type: 'beds' },
    { type: 'storage', kind: 'nightstand' },
    { type: 'textiles', kind: 'runner' },
    { type: 'ceilight', kind: 'flush' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'floorlamp', kind: 'table' },
    { type: 'tabletop', kind: 'vase' },
  ],
  laundry: [
    { type: 'storage', kind: 'cabinet' }, // the appliance run
    { type: 'tables', kind: 'table' }, // folding surface
    { type: 'functional', kind: 'basket', count: 2 }, // hampers
    { type: 'storage', kind: 'shelf' },
    { type: 'ceilight', kind: 'flush' },
    { type: 'hangingplants', kind: 'pothos' },
  ],
  entryway: [
    { type: 'storage', kind: 'cabinet' }, // console table
    { type: 'hangingplants', kind: 'ivy' },
    { type: 'functional', kind: 'basket' },
    { type: 'ceilight', kind: 'flush' },
    { type: 'walldecor', kind: 'mirror' },
    { type: 'tabletop', kind: 'bowl' },
    { type: 'tabletop', kind: 'vase' },
  ],
  hallway: [
    // Nothing bulky: a corridor has to stay walkable end to end.
    { type: 'walldecor', kind: 'artwork', count: 2 },
    { type: 'walllight', kind: 'sconce' },
    { type: 'ceilight', kind: 'flush', count: 2 },
    { type: 'functional', kind: 'basket' },
    { type: 'tabletop', kind: 'vase' },
  ],
  gym: [
    { type: 'textiles', kind: 'arearug' },
    { type: 'functional', kind: 'media' }, // equipment mass
    { type: 'storage', kind: 'shelf' },
    { type: 'seating', kind: 'bench' },
    { type: 'ceilight', kind: 'flush', count: 2 },
    { type: 'walllight' },
  ],
  sunroom: [
    { type: 'seating', kind: 'loveseat' },
    { type: 'seating', kind: 'accent', count: 2 },
    { type: 'tables', kind: 'coffee' },
    { type: 'textiles', kind: 'arearug' },
    { type: 'floorplants', kind: 'palm', count: 2 }, // light-hungry
    { type: 'ceilight', kind: 'pendant' },
  ],
  pantry: [
    { type: 'storage', kind: 'shelving', count: 2 },
    { type: 'storage', kind: 'cabinet' },
    { type: 'functional', kind: 'basket', count: 2 },
    { type: 'tabletop', kind: 'bowl' },
    { type: 'ceilight', kind: 'flush' },
  ],
  closet: [
    { type: 'storage', kind: 'shelving', count: 2 },
    { type: 'storage', kind: 'cabinet' },
    { type: 'functional', kind: 'basket', count: 2 },
    { type: 'tabletop', kind: 'box' },
    { type: 'ceilight', kind: 'flush' },
  ],
};

export const ROOM_LABEL: Record<RoomKind, string> = {
  living: 'Living room',
  dining: 'Dining room',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  kids: "Kids' room",
  nursery: 'Nursery',
  office: 'Home office',
  study: 'Study',
  library: 'Library',
  guest: 'Guest room',
  bathroom: 'Bathroom',
  laundry: 'Laundry room',
  entryway: 'Entryway',
  hallway: 'Hallway',
  gym: 'Home gym',
  sunroom: 'Sunroom',
  pantry: 'Pantry',
  closet: 'Walk-in closet',
};

/** Order the room-type picker is presented in. */
export const ROOM_KIND_ORDER: RoomKind[] = [
  'living',
  'dining',
  'kitchen',
  'bedroom',
  'kids',
  'nursery',
  'office',
  'study',
  'library',
  'guest',
  'bathroom',
  'laundry',
  'entryway',
  'hallway',
  'gym',
  'sunroom',
  'pantry',
  'closet',
];

/** Display name for a room: its custom label if set, else the kind's label. */
export function roomTitle(r: { kind: RoomKind; name: string }): string {
  return r.name.trim() || ROOM_LABEL[r.kind];
}
