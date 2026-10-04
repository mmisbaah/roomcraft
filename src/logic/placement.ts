// Rule-based "best fit" furniture placement.
//
// Floor items: score every free grid cell anchor by
//   - wall affinity  (sofas/beds hug walls, rugs/tables centre)
//   - centre affinity (tables and rugs prefer the middle of the room)
//   - door clearance  (never block the entry)
// Wall items are projected onto the best free wall span; ceiling items hang
// over a table (or the room centre); surface items sit on a table top.

import type { EdgeKind, FurnItem, FurnType, PlacedItem, RoomKind, Vec2 } from '../types';
import {
  cabinetsOnClearWall,
  chairsFaceTables,
  diningLayout,
  livingConversation,
  resolveOverlaps,
  spaceChairs,
} from './roomrules';
import { clamp01, distPointSeg, pointInPoly, polyArea, polyCentroid, rotatedSize, segsCross } from './geometry';
import { rectCells, rectCellsClamped, type Grid } from './grid';
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
  // Kitchens are planned as a working triangle, so the run of cabinets hugs
  // the wall hard and nothing is placed in the middle of the floor.
  kitchen: { wall: 1.35, center: 0.0, door: -1.5 },
  // Dining needs circulation all round the table, so it sits more centrally.
  dining: { wall: 0.85, center: 0.7, door: -1.2 },
  vanity: { wall: 1.0, center: 0.1, door: -1.0 },
  bathtub: { wall: 0.9, center: 0.3, door: -0.7 },
  shower: { wall: 0.8, center: 0.3, door: -0.7 },
  toilet: { wall: 1.0, center: -0.1, door: -1.6 },
  towelrack: { wall: 1.0, center: 0.3, door: -0.4 },
  vamirror: { wall: 1.0, center: 0.4, door: -0.6 },
  // The rule-driven categories. They behave like casegoods (hug the wall) with
  // the usual exceptions: kit you stand in the middle of — gym machines, a
  // laundry trolley, a closet island — is deliberately allowed toward the centre
  // so it does not end up jammed against a skirting board.
  nursery: { wall: 0.95, center: 0.3, door: -1.0 },
  gym: { wall: 0.7, center: 0.8, door: -1.6 },
  laundry: { wall: 1.15, center: 0.1, door: -1.5 },
  office: { wall: 1.0, center: 0.25, door: -1.3 },
  pantry: { wall: 1.1, center: 0.2, door: -1.2 },
  outdoor: { wall: 0.8, center: 0.5, door: -0.9 },
  closet: { wall: 1.05, center: 0.15, door: -1.2 },
  // A door goes in an opening, so it wants to be flat against a wall and as far
  // from the entrance path as the wall allows — the door values are the least
  // negative of any category for exactly that reason.
  doors: { wall: 1.0, center: 0.0, door: -0.5 },
};

/** Flat textiles (rugs, runners) — they don't block anything. */
export const isFlat = (f: FurnItem) => f.mount === 'floor' && !!f.spec.rug;
/** Floor items that occupy grid cells. */
const blocksFloor = (f: FurnItem) => f.mount === 'floor' && !f.spec.rug;

/** Pairs that may share cells (chairs tucked under tables; rugs under anything). */
export function overlapsAllowed(a: FurnItem, b: FurnItem): boolean {
  if (isFlat(a) || isFlat(b)) return true;
  const t = new Set([a.type, b.type]);
  return t.has('tables') && t.has('seating');
}

/**
 * The smallest gap, in metres, left between two floor pieces that have no
 * reason to touch.
 *
 * A dresser 4 cm from a hall bench and a lamp 12 cm from a bookcase read as
 * furniture that has been shoved into place rather than arranged: the eye
 * counts the gap before it counts the pieces. 15 cm is enough to show two
 * separate objects without opening a walkway between them.
 */
export const MIN_FLOOR_GAP = 0.15;

/**
 * Built-in runs — base and wall units, pantry and laundry joinery.
 *
 * A run of cabinets is one piece of woodwork rather than several objects at
 * odds with each other: its units touch, and a 15 cm gap between two base units
 * would look like a hole cut in the run.
 */
const RUN_KINDS = new Set([
  'basecab',
  'wallcab',
  'pantrycab',
  'pantryshelf',
  'laundrycab',
  'laundrywall',
]);

/**
 * May these two floor pieces sit closer than MIN_FLOOR_GAP?
 *
 * Five pairings earn the exemption. A run of joinery is a single object; a
 * chair is meant to be pushed into its table; the nightstand belongs against
 * the bed, and a gap between them reads as a piece that has been moved away;
 * a rug is walked on rather than looked at; and two chairs are rule 2's to
 * separate, not the floor's.
 */
export function gapAllowed(a: FurnItem, b: FurnItem): boolean {
  if (isFlat(a) || isFlat(b)) return true;
  if (RUN_KINDS.has(a.kind) || RUN_KINDS.has(b.kind)) return true;
  if (overlapsAllowed(a, b)) return true;
  // A stool at an island or a chair at a vanity is pulled up to the worktop —
  // the point is that it touches, and 15 cm of air would leave it stranded.
  const t = new Set([a.type, b.type]);
  if (t.has('seating') && (t.has('kitchen') || t.has('dining') || t.has('vanity'))) return true;
  if (a.kind === 'nightstand' && b.type === 'beds') return true;
  if (b.kind === 'nightstand' && a.type === 'beds') return true;
  // Two chairs. The walking-space pass is what keeps a free chair clear of its
  // neighbours, and the pair at a table sits a third of the table apart by
  // design: four dining chairs on a 1.4 m table are 47 cm apart centre to
  // centre, which is tighter than any floor gap could ever allow — refusing it
  // left one of the rule 4 chairs stranded on the far wall.
  if (isChair(a) && isChair(b)) return true;
  return false;
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
  // Counters, islands and peninsulas are worktops — a fruit bowl or a lamp has
  // to be able to stand on them, the same way it does on a table.
  if (f.type === 'kitchen' || f.type === 'dining') return f.h || 0.9;
  if (f.type === 'tables') return f.h || f.spec.h || 0.75;
  if (f.type === 'vanity') return f.h; // countertop — soaps & succulents sit here
  if (f.type === 'storage') {
    const h = f.h || f.spec.h || 0.8;
    return h <= 1.35 ? h : null;
  }
  if (f.type === 'beds') return 0.52;
  if (f.type === 'seating') return (f.spec.seatH ?? 0.45) + 0.14;
  // A worktop-height piece in the rule-driven categories is still a worktop:
  // the folding counter, the pantry cart and the closet island all have to be
  // able to carry a jar or a lamp. Kept to counter height so a tall shelf unit
  // or a gym rack never becomes a surface something is stood on.
  if (f.type === 'laundry' || f.type === 'pantry' || f.type === 'closet') {
    const h = f.h || 0;
    return h > 0.2 && h <= 1.0 ? h : null;
  }
  if (f.type === 'office') return isOfficeWorktop(f) ? f.h || 0.75 : null;
  return null;
}

/** Office desks and their converters are worktops; filing cabinets are not. */
function isOfficeWorktop(f: FurnItem): boolean {
  return f.kind === 'desk' || f.kind === 'standing';
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
  if (item.mount === 'wall' || item.mount === 'opening') {
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
  for (const idx of cells) if (grid.free[idx] !== 1) return false;
  if (isFlat(item)) return true;

  // Exact rect overlap, not "do we share a grid cell". Two footprints can
  // overlap by most of half a cell without sharing one, which let the fill
  // stand a chair 30 cm inside a sideboard. Walls stay on the coarse grid —
  // there the cell is the wall — but furniture is measured properly.
  for (const o of items) {
    if (o.uid === excludeUid) continue;
    const f = byId.get(o.itemId);
    if (!f || !blocksFloor(f) || isFlat(f) || overlapsAllowed(item, f)) continue;
    const os = rotatedSize(f.w, f.d, o.rot);
    if (rectsOverlap(x, y, w, d, o.x, o.y, os.w, os.d)) return false;
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
  if (item.mount === 'wall' || item.mount === 'opening') {
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
    // MIN_FLOOR_GAP widens both footprints by half, so two pieces that have no
    // reason to touch are refused when they would end up closer than the gap —
    // while joinery runs, tucked chairs and the bed's nightstand are free to
    // sit flush.
    const g = gapAllowed(item, f) ? 0 : MIN_FLOOR_GAP;
    if (dx < (w + os.w) / 2 + g && dy < (d + os.d) / 2 + g) return false;
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
  // Rule 1 — a sconce or picture light keeps its distance from every other
  // light. Filtered per edge so the scan still returns the best wall that
  // complies, rather than the best wall and then nothing.
  const light = isLight(item);
  let best: Spot | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < edges.length; i++) {
    const spot = sampleEdge(poly, items, byId, item, edges, i);
    if (!spot) continue;
    if (light && !lightSpacingClear(items, byId, spot.x, spot.y, item)) continue;
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
  // Rule 1 — this fitting keeps the spacing from *every* light already in the
  // room, not just the ceiling ones. `occ` above only sees ceiling mounts, so a
  // floor lamp standing under a lattice point would otherwise go unnoticed, and
  // the downlight would take a point 2 m from it. Tested inside the search so a
  // fitting denied its first choice takes a compliant one instead of being
  // refused outright — that is the difference between a room with one light and
  // a room with two.
  const spaced = isLight(item)
    ? (x: number, y: number) => lightSpacingClear(items, byId, x, y, item)
    : () => true;
  const tryPt = (x: number, y: number): Spot | null => {
    const sx = Math.round(x / 0.25) * 0.25;
    const sy = Math.round(y / 0.25) * 0.25;
    if (!rotRectInsidePoly(poly, sx, sy, item.w, item.d, 0)) return null;
    if (!free(sx, sy)) return null;
    if (!spaced(sx, sy)) return null;
    return { x: sx, y: sy, rot: 0 };
  };
  // Rule 1 — every ceiling light at least CEILING_LIGHT_SPACING from every other,
  // so the whole ceiling is laid out on one 3 m lattice rather than each fitting
  // finding its own spot.
  //
  // A recessed spot is ambient light and takes any free lattice point. A pendant
  // or flush disc is the feature fitting and takes the lattice point nearest the
  // table it lights — which is as close to over the table as the lattice allows.
  // Letting a recessed spot take a table position instead put it on the side
  // table beside the sofa, which is where a person puts a lamp.
  //
  // Lattice points are returned unsnapped: snapping to the 0.25 m placement grid
  // is what would drag a light off its point and break the spacing.
  if (item.type === 'ceilight') {
    const lattice = ceilingLightGrid(poly);
    if (lattice.length) {
      const anchor = item.kind === 'recessed' ? centroid : tables[0] ?? centroid;
      const ordered = [...lattice].sort(
        (a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y),
      );
      for (const g of ordered) {
        if (!spaced(g.x, g.y)) continue;
        if (!rotRectInsidePoly(poly, g.x, g.y, item.w, item.d, 0)) continue;
        return { x: g.x, y: g.y, rot: 0 };
      }
    }
  }
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
      if (!spaced(x, y)) continue;
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
      // Rule 1 — a table lamp's spot must keep the spacing too; a lamp on the
      // nightstand directly beneath a ceiling fitting is the same breach.
      if (isLight(item) && !lightSpacingClear(items, byId, wx, wy, item)) continue;
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
  // MIN_FLOOR_GAP, applied as the same widening: cells within the gap of a
  // piece that must keep its distance are treated as taken, so the scan lands
  // on a position with air around it rather than butting up against the sofa.
  const occGap = new Set<number>();
  if (!isFlat(item)) {
    for (const o of items) {
      const f = byId.get(o.itemId);
      if (!f || !blocksFloor(f) || isFlat(f) || gapAllowed(item, f)) continue;
      const sz = rotatedSize(f.w, f.d, o.rot);
      // Clamped, not plain rectCells: a piece flush against a wall is the one
      // case where the widened footprint leaves the grid, and dropping it there
      // would leave precisely the wall-adjacent furniture unchecked.
      for (const c of rectCellsClamped(
        grid,
        o.x,
        o.y,
        sz.w + 2 * MIN_FLOOR_GAP,
        sz.d + 2 * MIN_FLOOR_GAP,
      )) {
        occGap.add(c);
      }
    }
  }
  const rotations = opts?.rotations ?? [0, 90];
  const flat = isFlat(item);
  const light = isLight(item);
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
              if (occ.has(i + j * grid.cols) || occGap.has(i + j * grid.cols)) {
                ok = false;
                break;
              }
            }
          }
          if (!ok) continue;
        }
        // Rule 1 — a floor or table lamp takes a position that keeps the
        // spacing from every other light. Excluding positions here rather than
        // rejecting the winner afterwards is what lets a lamp take the far
        // corner: its preferred spot is beside the sofa, 2 m from the ceiling
        // fitting, and refusing only that spot used to lose the lamp entirely.
        if (light && !lightSpacingClear(items, byId, x, y, item)) continue;
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
 * Is this item a light, of any kind — ceiling, wall, floor or table?
 *
 * Rule 1 applies to all of them, not just the ceiling: a floor lamp 23 cm from
 * a ceiling fitting is the same breach as two downlights 23 cm apart, and the
 * rule is about how the room is lit rather than about which mount the fitting
 * hangs from.
 */
export function isLight(f: FurnItem): boolean {
  return f.type === 'ceilight' || f.type === 'walllight' || f.type === 'floorlamp';
}

/**
 * Would a light at this position keep the rule's distance from every light
 * already in the room?
 *
 * Centre to centre, which is what the rule is about: two fittings 3 m apart
 * centre to centre are 3 m apart, whatever their diameters.
 */
export function lightSpacingClear(
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  x: number,
  y: number,
  item: FurnItem,
  excludeUid?: string,
): boolean {
  return items.every((o) => {
    if (o.uid === excludeUid) return true;
    const of = byId.get(o.itemId);
    if (!of || !isLight(of)) return true;
    return Math.hypot(o.x - x, o.y - y) >= CEILING_LIGHT_SPACING - 1e-9;
  });
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
  const spot = findBestSpotInner(grid, poly, items, byId, item, edges, opts);
  // Rule 1 — a light must keep the spacing from every light already placed.
  // Checked here rather than inside each spot-finder so it applies to every
  // mount: a wall sconce and a floor lamp are bound by the same rule as a
  // downlight, and the ceiling lattice alone does not see them.
  if (spot && isLight(item) && !lightSpacingClear(items, byId, spot.x, spot.y, item)) {
    return null;
  }
  return spot;
}

function findBestSpotInner(
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
    // A door moves freely — anywhere in the room, at any rotation. It is only
    // *an opening* once it happens to be standing in a wall, which is a
    // consequence of where you put it rather than a rule about where it may go.
    case 'opening':
      return findFloorSpot(grid, poly, items, byId, item, edges, opts);
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
export function rectsOverlap(
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
 * cellsFree plus an exact footprint check against every other blocking item —
 * at MIN_FLOOR_GAP when the pair owes each other one. Unlike canPlace's
 * cell-based occupancy this allows two pieces to share a grid cell when their
 * footprints don't actually touch, which is what keeps the nightstand's 5–15 cm
 * and the chair nudges possible; but a correction that only ever asked about
 * intersection could settle a dispute with one neighbour by parking the piece
 * against a second, which is how a pass meant to separate furniture ended up
 * leaving it touching. Every move is therefore held to the same spacing the
 * original placement was.
 */
export function strictFit(
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
  // Rule 1 applies to a move exactly as it did to the original placement: a
  // corrective slide that opened a 15 cm gap by walking a floor lamp from 3 m
  // to 2.95 m from the ceiling fitting would be trading one breach for another.
  if (isLight(item) && !lightSpacingClear(items, byId, x, y, item, excludeUid)) return false;
  if (opts?.skipOverlap) return true;
  const { w, d } = rotatedSize(item.w, item.d, rot);
  for (const o of items) {
    if (o.uid === excludeUid) continue;
    const f = byId.get(o.itemId);
    if (!f || !blocksFloor(f)) continue;
    const os = rotatedSize(f.w, f.d, o.rot);
    const g = gapAllowed(item, f) ? 0 : MIN_FLOOR_GAP;
    if (
      Math.abs(x - o.x) < (w + os.w) / 2 + g - 0.02 &&
      Math.abs(y - o.y) < (d + os.d) / 2 + g - 0.02
    ) {
      return false;
    }
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
  roomKind: RoomKind = 'living',
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

  // Written room rules — relationships between pieces rather than any one
  // piece. Turning and seating come first, spacing last: rotating a chair
  // changes its footprint, so a chair spaced out and then turned is a chair
  // that has walked into whatever it was given room from.
  chairsFaceTables(grid, poly, items, byId);
  if (roomKind === 'living') livingConversation(grid, poly, items, byId);
  // Cabinets settle before the dining table does. A sideboard that arrives
  // afterwards can take the one wall a chair needed to sit against, and then
  // the table can only be seated three chairs to the floor.
  cabinetsOnClearWall(grid, poly, items, byId);
  if (roomKind === 'dining') diningLayout(grid, poly, items, byId);
  spaceChairs(grid, poly, items, byId, CHAIR_WALK_SPACE);
  resolveOverlaps(grid, poly, items, byId);
  // The repair pass may have turned something to get it out of a neighbour, so
  // facing is re-applied — and then a final slide-only sweep, which cannot
  // undo it, makes sure the room is still free of overlaps.
  chairsFaceTables(grid, poly, items, byId);
  resolveOverlaps(grid, poly, items, byId, { rotate: false });
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
    if (!f) return false;
    // Dining tables now live in their own category; the coffee-table rule still
    // covers the living room.
    if (f.type === 'dining' && ['dining', 'round', 'trestle', 'bar', 'oval', 'banquet'].includes(f.kind)) return true;
    return f.type === 'tables' && (f.kind === 'coffee' || f.kind === 'dining');
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
  // Rule 1 still binds while it moves. The pendant starts on the lattice point
  // nearest the centroid — the table has not been placed yet — and by the time
  // this runs the lamps have placed themselves 3 m from *that* position. Moving
  // it over the table blind would put it half that from the floor lamp beside
  // the sofa, so the move only happens when the spacing survives it; staying
  // off-centre is the lesser fault.
  if (!lightSpacingClear(items, byId, sx, sy, pf, pendant.uid)) return;
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
// Quantity guidelines
// ---------------------------------------------------------------------------

/**
 * How much floor a room's furniture may take, as a fraction of the floor area.
 *
 * The guideline is blunt about this: past roughly 30% coverage a room stops
 * reading as furnished and starts reading as blocked, and a small room gets a
 * little more tolerance because there is no room to be cramped in. Enforcing it
 * while filling is what makes a plan come out complete yet uncluttered — without
 * it the fill packs every square metre it can reach, which measured 43% of the
 * floor in a home gym and 33% in a living room.
 */
export const COVERAGE_BUDGET = 0.3;
export const COVERAGE_BUDGET_SMALL = 0.4;
/** Below this floor area (m²) a room counts as small. */
export const SMALL_ROOM_AREA = 16;

/**
 * The share of the floor a room's furniture should reach before the fill stops.
 *
 * The ceiling alone is not enough: the preset lists are a fixed *count*, so a
 * large room was left nearly bare — 21 items across 5% of a 120 m² living room
 * reads as empty, not as spacious. This is the other half of the same rule, and
 * it sits far enough below the ceiling that the two never come into conflict.
 */
export const COVERAGE_FLOOR = 0.1;

/**
 * How many pieces of floor furniture one room may hold.
 *
 * The guideline is 4-8 for a typical room, so 8 is the ceiling. Rooms whose own
 * guidance says otherwise get their own number rather than being forced into a
 * limit that would strip them of the reason they exist — a gym is told to want
 * 4-10 pieces of equipment, and a squat rack, treadmill and rower already eat
 * the floor.
 */
export const FLOOR_PIECE_LIMIT = 8;
const FLOOR_PIECE_LIMIT_BY_KIND: Partial<Record<RoomKind, number>> = {
  gym: 10,
  kitchen: 10,
  laundry: 10,
  library: 10,
  sunroom: 10,
  pantry: 9,
  kids: 9,
  // Every piece a hall calls for is small — coat rack, umbrella stand, baskets,
  // ottomans, consoles tenth of a square metre each — so nine of them cannot
  // even touch the coverage floor in a room of any real size, and a large
  // entryway stalled at ~8.5%.
  entryway: 12,
};

/** Floor-coverage allowance for a room of this size. */
export function coverageBudget(roomArea: number): number {
  return roomArea < SMALL_ROOM_AREA ? COVERAGE_BUDGET_SMALL : COVERAGE_BUDGET;
}

/** The floor area the 4-8 piece guideline is written about. */
const TYPICAL_ROOM_AREA = 22.5;

/**
 * Clear floor a chair needs around itself to be walked round and sat down on.
 *
 * A chair hard against a wall cannot be pulled out, which is the difference
 * between a seat and an obstruction.
 */
export const CHAIR_WALK_SPACE = 0.6;

/**
 * Rule 1 — minimum distance between ceiling lights: 3 m.
 *
 * This is the same rule as "one light per 9 square metres" (a 3 m lattice gives
 * each fitting 9 m²), but stated as a spacing it is the version that can
 * actually be built. The area form ignores the walls: a 3 × 3 m room has 9 m²
 * and so "wants" two lights, when there is only room for one. The spacing form
 * has no such problem, so the count follows the geometry rather than the
 * arithmetic.
 *
 * ERCO's guidance for uniform general lighting is a spacing of up to 1.5× the
 * height of the fitting above the working plane, with half that spacing left to
 * the wall. At a 2.7 m ceiling that is about 4 m, so 3 m is a comfortable
 * margin rather than the bare minimum.
 */
export const CEILING_LIGHT_SPACING = 3;

/**
 * The lattice of ceiling-light positions for a room, in metres.
 *
 * Each axis is divided into as many 3 m spans as it will hold, and the fittings
 * are spread evenly with equal gaps left at both ends. So a 6 m wall carries two
 * lights 1.5 m in from each end and 4.5 m from the other, and a 5 m wall
 * carries one in the middle rather than two squeezed together.
 *
 * The lattice is laid out over the room's bounding box and then clipped to the
 * room itself, so an L-shaped plan gets lights in the parts of the grid it
 * actually covers and none in the notch.
 */
export function ceilingLightGrid(poly: Vec2[]): Vec2[] {
  if (poly.length < 3) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const axis = (lo: number, span: number): number[] => {
    const n = Math.max(1, Math.floor(span / CEILING_LIGHT_SPACING));
    if (n === 1) return [lo + span / 2];
    const margin = (span - (n - 1) * CEILING_LIGHT_SPACING) / 2;
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(lo + margin + i * CEILING_LIGHT_SPACING);
    return out;
  };

  const xs = axis(minX, maxX - minX);
  const ys = axis(minY, maxY - minY);
  const pts: Vec2[] = [];
  for (const x of xs) {
    for (const y of ys) {
      if (pointInPoly({ x, y }, poly)) pts.push({ x, y });
    }
  }
  // A room too shallow or too oddly shaped to contain a lattice point still
  // gets one light, at its centre.
  if (!pts.length) {
    const c = polyCentroid(poly);
    pts.push({ x: c.x, y: c.y });
  }
  return pts;
}

/** How many ceiling lights a room of this shape gets. */
export function ceilingLightsFor(poly: Vec2[]): number {
  return ceilingLightGrid(poly).length;
}

/**
 * Floor area above which a room may repeat pieces.
 *
 * The no-duplicates rule is right for a normal room and quietly impossible for a
 * large one: without repeats a 120 m² pantry has a ceiling of about 1.6 m² of
 * furniture, so the coverage floor could never be met.
 */
export const DUPLICATE_FREE_AREA_MAX = 40;

/**
 * Kinds that are a chair someone sits on — not a stool, bench or ottoman.
 *
 * This lives here rather than in the rules module because placement needs it
 * too: the chairs rule 2 counts are the same chairs the floor gap has to make
 * room for, and two definitions of "chair" are two chances to disagree.
 */
const CHAIR_KINDS = new Set(['dining', 'accent', 'armchair', 'office', 'desk']);

export function isChair(f: FurnItem): boolean {
  return f.type === 'seating' && CHAIR_KINDS.has(f.kind);
}

/**
 * Rule 2 — at most this many chairs, in any room but a dining room.
 *
 * A dining room is exempt because rule 4 puts four chairs around the table, and
 * because a table with two chairs is a bench with a table on it. Everywhere
 * else, seating is the sofa plus a couple of chairs, and a fourth chair in an
 * office or a library is one more thing to walk around.
 */
export const CHAIR_LIMIT = 2;

/** Rooms the chair limit does not apply to. */
export const CHAIR_LIMIT_EXEMPT: RoomKind[] = ['dining'];

/**
 * Rule 3 — the kinds allowed to appear more than once in a room, beyond chairs
 * (rule 2) and ceiling lights (rule 1).
 *
 * Two groups earn the exemption. Built-in joinery is exempt because a kitchen
 * *is* cabinets: capping a 16 m² kitchen at one base unit and one wall unit
 * would leave it unable to hold a sink and a hob, which is not a kitchen with
 * sparse cupboards but a different room. Paired decor is exempt because a pair
 * is the design — one cushion on a sofa reads as an oversight, and a single
 * sconce lights one side of a room and leaves the other dark.
 */
export const REPEAT_EXEMPT = new Set([
  // Built-in joinery runs.
  'basecab',
  'wallcab',
  'pantrycab',
  'pantryshelf',
  'laundrycab',
  'laundrywall',
  'drawerbank',
  // Paired decor.
  'pillow',
  'sconce',
]);

/**
 * At most this many items of one category in a room.
 *
 * "Category" is the furniture type — seating, tables, storage, textiles. The
 * one-of-each-kind rule already forbids two of the same kind, but a living room
 * could still take a coffee table, two side tables and a console, which is four
 * tables and reads as cluttered however different they are. Two per category is
 * what a furnished room actually holds.
 *
 * Built-in joinery is exempt, because a kitchen is made of cabinets and capping
 * it at two would leave out the sink. Flat textiles are exempt because a rug is
 * walked on rather than looked at.
 */
export const CATEGORY_LIMIT = 2;

/** Categories that are there to look at rather than to be used. */
export const DECOR_TYPES = new Set(['walldecor', 'textiles', 'plant', 'tabletop']);

/**
 * At most this many decorative items in a room.
 *
 * Decor is the fastest way to make a room feel crowded, because each piece is
 * small and the eye counts them: a bedroom with four prints, six cushions, a
 * throw and three plants has ten things to look at and nowhere to rest. Four is
 * enough to finish a room; past that it is noise.
 */
export const DECOR_LIMIT = 4;

/**
 * Floor-piece allowance for a room of this kind and size.
 *
 * The guideline's 4-8 is about a *typical* room, so it is the baseline rather
 * than a hard ceiling: eight pieces is generous in 22 m² and nowhere near
 * enough in 120 m², where the same eight left 95% of the floor bare. The
 * allowance therefore grows with the floor, on a square-root curve so a large
 * open-plan space gets more furniture without the count running away.
 */
export function floorPieceLimit(kind: RoomKind, area = TYPICAL_ROOM_AREA): number {
  const base = FLOOR_PIECE_LIMIT_BY_KIND[kind] ?? FLOOR_PIECE_LIMIT;
  if (area <= TYPICAL_ROOM_AREA) return base;
  return Math.max(base, Math.round(base * Math.sqrt(area / TYPICAL_ROOM_AREA)));
}

/**
 * Round an accessory count to something that looks deliberate.
 *
 * The guideline is odd numbers — three, five, seven — because a perfectly
 * symmetrical pair pulls the eye to the gap in the middle. A step asking for two
 * vases therefore buys three and one asking for four cushions buys five. One is
 * left alone: a single object is already as unbalanced as it gets.
 */
export function oddCount(n: number): number {
  if (n <= 1) return n;
  return n % 2 === 0 ? n + 1 : n;
}

// ---------------------------------------------------------------------------
// AI fill presets
// ---------------------------------------------------------------------------

export interface PresetStep {
  type: FurnType;
  kind?: string;
  count?: number;
  /**
   * This step is a group of accessories rather than furniture — cushions,
   * vases, a set of candles — so its count is rounded to an odd number. A
   * symmetrical pair pulls the eye to the gap in the middle; three, five or
   * seven read as deliberate.
   */
  group?: boolean;
}

/**
 * What AI Fill puts in each kind of room, in placement order.
 *
 * Order matters: the large anchoring pieces (beds, sofas, the working triangle)
 * go down first so the smaller things fit around them, and the surfaces that
 * carry objects come before the objects themselves.
 *
 * Every room gets a ceiling light. Rooms are lit from above in reality, and it
 * is the cheapest way to make a layout read as a room rather than a floorplan —
 * so it is added unconditionally rather than trusting each list to include one.
 *
 * Each list below follows that room's written specification object for object,
 * including the pieces that needed library categories of their own (a nursery's
 * crib and mobile, a gym's treadmill and squat rack, a laundry's washer and
 * drying rack, an office's filing cabinet and footrest, a pantry's can
 * organizers, a sunroom's porch swing, a closet's valet stand). Where a rule
 * names something and the library now holds it, the rule wins — a nursery gets
 * a crib rather than whichever bed the category falls back to.
 *
 * \`kind\` narrows the pool only when the library actually has that kind, so a
 * step naming a kind the current tier can't reach falls back to the rest of the
 * category instead of placing nothing. ROOM_QUANTITY in store.ts then caps how
 * many of each piece one room may hold.
 */
export const PRESETS: Record<RoomKind, PresetStep[]> = {
  living: [
    // Furniture — the seating group anchors the room.
    { type: 'textiles', kind: 'arearug' },
    { type: 'seating', kind: 'sofa' },
    { type: 'seating', kind: 'loveseat' },
    { type: 'seating', kind: 'accent', count: 2 },
    { type: 'tables', kind: 'coffee' },
    { type: 'tables', kind: 'side', count: 2 },
    { type: 'storage', kind: 'media' }, // TV stand
    { type: 'seating', kind: 'ottoman' }, // ottoman or pouf
    { type: 'storage', kind: 'bookcase' },
    // Design objects.
    { type: 'tabletop', kind: 'candle' },
    { type: 'tabletop', kind: 'vase' },
    { type: 'tabletop', kind: 'tray' },
    { type: 'tableplants', kind: 'lily' },
    { type: 'floorlamp', kind: 'floor' },
    { type: 'floorlamp', kind: 'table' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'walldecor', kind: 'mirror' },
    { type: 'textiles', kind: 'pillow', count: 2, group: true },
    { type: 'textiles', kind: 'throw' },
    { type: 'textiles', kind: 'curtain' },
    { type: 'floorplants', kind: 'monstera' },
  ],
  dining: [
    // Furniture — the table anchors the room, chairs ring it.
    { type: 'dining', kind: 'dining' },
    { type: 'seating', kind: 'dining', count: 4 },
    { type: 'dining', kind: 'bench' }, // bench seating
    { type: 'dining', kind: 'buffet' }, // sideboard
    { type: 'dining', kind: 'barcart' },
    { type: 'dining', kind: 'china' },
    // Design objects.
    { type: 'textiles', kind: 'arearug' },
    { type: 'ceilight', kind: 'chandelier' },
    { type: 'textiles', kind: 'tablerunner' }, // table linens
    { type: 'tabletop', kind: 'vase' }, // centrepiece
    { type: 'tabletop', kind: 'bowl' },
    { type: 'tabletop', kind: 'candle' },
    { type: 'walldecor', kind: 'artwork' },
    { type: 'walldecor', kind: 'mirror' },
    { type: 'walllight', kind: 'sconce', count: 2 },
  ],
  kitchen: [
    // Furniture — the working triangle first, then the surfaces.
    { type: 'kitchen', kind: 'fridge' },
    { type: 'kitchen', kind: 'sinkbase' },
    { type: 'kitchen', kind: 'range' },
    { type: 'kitchen', kind: 'dishwasher' },
    { type: 'kitchen', kind: 'island' },
    { type: 'kitchen', kind: 'basecab', count: 4 },
    { type: 'kitchen', kind: 'wallcab', count: 3 },
    { type: 'kitchen', kind: 'pantry' }, // pantry shelving
    { type: 'seating', kind: 'stool', count: 2 }, // bar stools
    { type: 'kitchen', kind: 'hood' }, // over the hob
    // Design objects.
    { type: 'pantry', kind: 'backsplash' }, // backsplash tiles
    { type: 'ceilight', kind: 'pendant', count: 2 }, // over the island
    { type: 'archlight', kind: 'undercab', count: 2 }, // under-cabinet lighting
    { type: 'pantry', kind: 'crock' }, // utensil crock
    { type: 'pantry', kind: 'board' }, // cutting board
    { type: 'kitchen', kind: 'wallcab' }, // open shelving decor
    { type: 'tabletop', kind: 'bowl' }, // fruit bowl
    { type: 'textiles', kind: 'runner' }, // small rug
    { type: 'walldecor', kind: 'clock' }, // wall clock
    { type: 'tableplants', kind: 'evergreen' },
    { type: 'functional', kind: 'basket' },
  ],
  bedroom: [
    // Furniture.
    { type: 'textiles', kind: 'arearug' },
    { type: 'beds' },
    { type: 'storage', kind: 'nightstand', count: 2 },
    { type: 'storage', kind: 'dresser' },
    { type: 'storage', kind: 'armoire' }, // wardrobe
    { type: 'seating', kind: 'bench' }, // bench at the foot of the bed
    { type: 'seating', kind: 'accent' }, // occasional chair
    { type: 'tables', kind: 'vanity' }, // vanity table
    // Design objects.
    { type: 'floorlamp', kind: 'table', count: 2 }, // bedside lamps
    { type: 'walllight', kind: 'sconce', count: 2 },
    { type: 'walldecor', kind: 'artwork' }, // above the headboard
    { type: 'walldecor', kind: 'mirror' },
    { type: 'textiles', kind: 'pillow', count: 2, group: true }, // duvet and pillows
    { type: 'textiles', kind: 'throw' },
    { type: 'textiles', kind: 'curtain' }, // blackout curtains
    { type: 'tabletop', kind: 'box' }, // jewellery box
    { type: 'walldecor', kind: 'clock' }, // alarm clock
    { type: 'tableplants', kind: 'polka' },
    { type: 'walldecor', kind: 'canvas' },
  ],
  kids: [
    // Furniture — a bunk bed when there is room for one, which is what the
    // rule asks for ahead of everything else.
    { type: 'beds' },
    { type: 'nursery', kind: 'bunk' },
    { type: 'textiles', kind: 'arearug' }, // play rug
    { type: 'tables', kind: 'desk' },
    { type: 'seating', kind: 'dining' }, // desk chair
    { type: 'storage', kind: 'chest', count: 2 }, // toy storage
    { type: 'storage', kind: 'bookcase' },
    { type: 'seating', kind: 'pouf' }, // bean bag chair
    { type: 'storage', kind: 'dresser' },
    // Design objects.
    { type: 'nursery', kind: 'nightlight' }, // nightlight
    { type: 'nursery', kind: 'glowstar' }, // glow-in-the-dark stars
    { type: 'walldecor', kind: 'artwork', count: 2 }, // colourful wall art
    { type: 'walldecor', kind: 'canvas' }, // posters
    { type: 'nursery', kind: 'canopy' }, // hanging canopy
    { type: 'textiles', kind: 'pillow', count: 2, group: true }, // playful bedding
    { type: 'textiles', kind: 'throw' },
    { type: 'functional', kind: 'basket', count: 2 }, // toy organisers
    { type: 'nursery', kind: 'toybin' },
    { type: 'floorplants', kind: 'zz' },
  ],
  nursery: [
    // Furniture — the crib first, because the mobile hangs over it.
    { type: 'nursery', kind: 'crib' },
    { type: 'nursery', kind: 'mobile' }, // mobile above the crib
    { type: 'nursery', kind: 'changing' }, // changing table
    { type: 'nursery', kind: 'bassinet' },
    { type: 'nursery', kind: 'glider' }, // glider / rocking chair
    { type: 'nursery', kind: 'pail' }, // diaper pail
    { type: 'storage', kind: 'dresser' },
    { type: 'storage', kind: 'bookcase' },
    // Design objects.
    { type: 'nursery', kind: 'toybasket' }, // soft toy basket
    { type: 'textiles', kind: 'arearug' }, // soft rug
    { type: 'textiles', kind: 'curtain' }, // blackout curtains
    { type: 'nursery', kind: 'nightlight' },
    { type: 'nursery', kind: 'soundmachine' }, // sound machine
    { type: 'nursery', kind: 'monitor' }, // baby monitor
    { type: 'walldecor', kind: 'canvas', count: 2 }, // wall decals
    { type: 'nursery', kind: 'bunting' },
    { type: 'tableplants', kind: 'calathea' },
  ],
  office: [
    // Furniture — the desk and its chair anchor the room.
    { type: 'textiles', kind: 'arearug' },
    { type: 'office', kind: 'desk' },
    { type: 'office', kind: 'taskchair' }, // ergonomic office chair
    { type: 'office', kind: 'standing' }, // standing desk converter
    { type: 'office', kind: 'filing' }, // filing cabinet
    { type: 'storage', kind: 'bookcase' },
    { type: 'seating', kind: 'accent' }, // guest chair
    // Design objects.
    { type: 'office', kind: 'monitor' },
    { type: 'office', kind: 'keyboard' },
    { type: 'office', kind: 'mouse' },
    { type: 'office', kind: 'cabletray' }, // cable management
    { type: 'office', kind: 'footrest' },
    { type: 'office', kind: 'organiser' }, // desk organiser
    { type: 'office', kind: 'wastebasket' },
    { type: 'office', kind: 'tissue' },
    { type: 'floorlamp', kind: 'desk' }, // task lamp
    { type: 'office', kind: 'pinboard' }, // wall calendar
    { type: 'walldecor', kind: 'artwork' }, // motivational art
    { type: 'tableplants', kind: 'evergreen' }, // desk plant
    { type: 'walllight', kind: 'sconce' },
  ],
  study: [
    // Furniture.
    { type: 'textiles', kind: 'arearug' },
    { type: 'tables', kind: 'desk' }, // writing desk
    { type: 'seating', kind: 'accent' }, // reading chair
    { type: 'storage', kind: 'bookcase', count: 2 }, // tall bookshelves
    { type: 'storage', kind: 'credenza' },
    { type: 'office', kind: 'filing' }, // filing cabinet
    // Design objects.
    { type: 'floorlamp', kind: 'desk' }, // desk lamp
    { type: 'office', kind: 'globe' },
    { type: 'walldecor', kind: 'canvas', count: 2 }, // framed maps
    { type: 'walllight', kind: 'sconce', count: 2 },
    { type: 'tabletop', kind: 'bookends' },
    { type: 'tabletop', kind: 'books' }, // writing accessories
    { type: 'tabletop', kind: 'candle' }, // scented candle
    { type: 'walldecor', kind: 'tapestry' },
  ],
  library: [
    // Furniture — floor-to-ceiling shelving is the point of the room.
    { type: 'storage', kind: 'bookcase', count: 3 },
    { type: 'office', kind: 'rollingladder' }, // rolling ladder
    { type: 'seating', kind: 'accent', count: 2 }, // tufted reading chairs
    { type: 'seating', kind: 'chaise' }, // chaise lounge
    { type: 'tables', kind: 'side', count: 2 },
    { type: 'tables', kind: 'desk' }, // small writing desk
    { type: 'textiles', kind: 'arearug' },
    // Design objects.
    { type: 'floorlamp', kind: 'table', count: 2 }, // banker's lamps
    { type: 'floorlamp', kind: 'reading' },
    { type: 'tabletop', kind: 'bookends' },
    { type: 'tabletop', kind: 'books' },
    { type: 'walldecor', kind: 'canvas', count: 2 }, // framed portraits
    { type: 'office', kind: 'bust' }, // busts
    { type: 'office', kind: 'glassesstand' }, // reading glasses stand
    { type: 'textiles', kind: 'throw' }, // cozy blankets
    { type: 'tableplants', kind: 'evergreen' },
    { type: 'ceilight', kind: 'chandelier' },
    { type: 'walllight', kind: 'swing' }, // library swing lamps
  ],
  guest: [
    // Furniture.
    { type: 'textiles', kind: 'arearug' },
    { type: 'beds' },
    { type: 'storage', kind: 'nightstand' },
    { type: 'storage', kind: 'dresser' },
    { type: 'closet', kind: 'luggage' }, // luggage rack
    { type: 'seating', kind: 'daybed' }, // fold-out sofa
    { type: 'tables', kind: 'desk' }, // small desk or vanity
    // Design objects.
    { type: 'floorlamp', kind: 'table' }, // bedside lamp
    { type: 'walldecor', kind: 'mirror' },
    { type: 'textiles', kind: 'pillow', count: 2, group: true }, // neutral bedding
    { type: 'towelrack' }, // fresh towels
    { type: 'tabletop', kind: 'tray' }, // welcome tray
    { type: 'tabletop', kind: 'bowl' }, // water and snacks
    { type: 'office', kind: 'tissue' },
    { type: 'closet', kind: 'hanger' }, // closet hangers
    { type: 'walldecor', kind: 'artwork' },
    { type: 'floorplants', kind: 'snake' },
  ],
  bathroom: [
    // Furniture — the vanity claims its wall, then the mirror centres on it.
    { type: 'vanity' },
    { type: 'vamirror' },
    { type: 'toilet' },
    { type: 'shower' },
    { type: 'bathtub' },
    { type: 'storage', kind: 'cabinet' }, // linen cabinet
    { type: 'storage', kind: 'shelving' }, // shelving unit
    // Design objects.
    { type: 'towelrack', count: 2 }, // towel bars
    { type: 'textiles', kind: 'arearug' }, // bath mat
    { type: 'textiles', kind: 'curtain' }, // shower curtain
    { type: 'tabletop', kind: 'diffuser' }, // soap dispenser
    { type: 'tabletop', kind: 'vase' }, // toothbrush holder
    { type: 'tabletop', kind: 'bowl' }, // decorative jars
    { type: 'succulents', count: 2 },
    { type: 'walllight', kind: 'vanity', count: 2 }, // sconces
    { type: 'walldecor', kind: 'artwork' },
    { type: 'walllight', kind: 'sconce' },
  ],
  laundry: [
    // Furniture — the appliance run along one wall.
    { type: 'laundry', kind: 'washer' },
    { type: 'laundry', kind: 'dryer' },
    { type: 'laundry', kind: 'foldcounter' }, // folding counter
    { type: 'laundry', kind: 'utilsink' }, // utility sink
    { type: 'laundry', kind: 'laundrycab', count: 2 }, // base cabinets
    { type: 'laundry', kind: 'rod' }, // hanging rod
    { type: 'laundry', kind: 'hamper', count: 2 }, // sorting hampers
    // Design objects.
    { type: 'laundry', kind: 'dryingrack' },
    { type: 'laundry', kind: 'ironingboard' },
    { type: 'laundry', kind: 'iron', count: 2 },
    { type: 'laundry', kind: 'clothespin' }, // clothespins
    { type: 'laundry', kind: 'detergent', count: 2 }, // detergent jars
    { type: 'laundry', kind: 'hookrail' }, // wall hooks
    { type: 'laundry', kind: 'laundrymat' }, // patterned floor rug
    { type: 'laundry', kind: 'utilityshelf' },
    { type: 'archlight', kind: 'undercab', count: 2 }, // under-cabinet lighting
    { type: 'walldecor', kind: 'artwork' },
    { type: 'walldecor', kind: 'clock' },
    { type: 'tableplants', kind: 'evergreen' },
  ],
  entryway: [
    // Furniture.
    { type: 'tables', kind: 'console' },
    { type: 'seating', kind: 'bench' }, // entryway bench
    { type: 'storage', kind: 'cabinet' }, // shoe cabinet
    { type: 'functional', kind: 'coatrack', count: 2 }, // coat rack / hall tree
    { type: 'seating', kind: 'ottoman' }, // storage ottoman
    { type: 'functional', kind: 'umbrella' }, // umbrella stand
    // Design objects.
    { type: 'textiles', kind: 'runner' }, // runner rug / doormat
    { type: 'walldecor', kind: 'mirror' },
    { type: 'tabletop', kind: 'bowl' }, // key bowl
    { type: 'tabletop', kind: 'tray' },
    { type: 'towelrack' }, // wall hooks
    { type: 'floorlamp', kind: 'table' }, // table lamp
    { type: 'walldecor', kind: 'canvas' },
    { type: 'functional', kind: 'basket', count: 2 },
  ],
  hallway: [
    // Furniture — deliberately sparse: a corridor has to stay walkable.
    { type: 'tables', kind: 'console' }, // narrow console
    { type: 'storage', kind: 'cabinet' }, // slim shoe cabinet
    { type: 'seating', kind: 'bench' },
    { type: 'towelrack', count: 2 }, // coat hooks
    // Design objects.
    { type: 'textiles', kind: 'runner' },
    { type: 'walldecor', kind: 'canvas', count: 3 }, // gallery wall
    { type: 'walldecor', kind: 'artwork' },
    { type: 'walllight', kind: 'sconce', count: 2 },
    { type: 'walldecor', kind: 'mirror' },
    { type: 'tabletop', kind: 'bowl' },
    { type: 'tabletop', kind: 'vase' }, // fresh flowers
    { type: 'functional', kind: 'basket' },
  ],
  gym: [
    // Furniture — the equipment is what a gym is.
    { type: 'textiles', kind: 'arearug' }, // rubber gym flooring
    { type: 'gym', kind: 'treadmill' },
    { type: 'gym', kind: 'bike' }, // stationary bike
    { type: 'gym', kind: 'squatrack' },
    { type: 'gym', kind: 'weightbench' },
    { type: 'gym', kind: 'dumbbellrack' }, // storage racks for weights
    { type: 'gym', kind: 'platetree' },
    { type: 'gym', kind: 'kettlebell' },
    { type: 'gym', kind: 'yogamat' },
    { type: 'gym', kind: 'rower' },
    { type: 'gym', kind: 'punchingbag' },
    { type: 'gym', kind: 'step' },
    { type: 'gym', kind: 'medball' },
    // Design objects.
    { type: 'walldecor', kind: 'mirror' }, // large wall mirror
    { type: 'walldecor', kind: 'artwork', count: 2 }, // motivational posters
    { type: 'ceilight', kind: 'fan' }, // wall-mounted fan
    { type: 'gym', kind: 'bottlestation' }, // water bottle station
    { type: 'gym', kind: 'soundsystem' },
    { type: 'archlight', kind: 'ledstrip', count: 2 }, // LED strip lighting
    { type: 'gym', kind: 'jumprope' },
    { type: 'gym', kind: 'bands' },
    { type: 'towelrack' }, // towel hooks
    { type: 'tableplants', kind: 'evergreen' },
  ],
  sunroom: [
    // Furniture.
    { type: 'outdoor', kind: 'rattansofa' }, // wicker sofa
    { type: 'outdoor', kind: 'rattanchair', count: 2 }, // lounge chairs
    { type: 'tables', kind: 'coffee' },
    { type: 'outdoor', kind: 'bistro' }, // dining set
    { type: 'outdoor', kind: 'porchswing' },
    { type: 'outdoor', kind: 'wickertable' },
    // Design objects.
    { type: 'outdoor', kind: 'outdoorrug' }, // indoor/outdoor rug
    { type: 'floorplants', kind: 'palm', count: 2 }, // potted plants
    { type: 'floorplants', kind: 'dracaena' },
    { type: 'outdoor', kind: 'planter' },
    { type: 'ceilight', kind: 'fan' }, // ceiling fan
    { type: 'textiles', kind: 'curtain' }, // sheer curtains
    { type: 'textiles', kind: 'pillow', count: 2, group: true }, // weather-resistant pillows
    { type: 'outdoor', kind: 'chimes' }, // wind chimes
    { type: 'outdoor', kind: 'lantern', count: 2 },
    { type: 'outdoor', kind: 'feeder' }, // bird feeder
    { type: 'tabletop', kind: 'vase' },
    { type: 'walllight', kind: 'sconce' },
  ],
  pantry: [
    // Furniture — storage is the whole point of a pantry.
    { type: 'pantry', kind: 'pantryshelf', count: 2 }, // adjustable shelving
    { type: 'pantry', kind: 'pantrycab' }, // freestanding cabinets
    { type: 'pantry', kind: 'pantrycart', count: 2 }, // rolling carts
    { type: 'pantry', kind: 'pantrywine' }, // wine rack
    { type: 'pantry', kind: 'stepstool' },
    // Design objects.
    { type: 'pantry', kind: 'clearbin', count: 3 }, // clear storage bins
    { type: 'functional', kind: 'basket', count: 2 },
    { type: 'pantry', kind: 'lazysusan' },
    { type: 'pantry', kind: 'canorg' }, // can organizers
    { type: 'pantry', kind: 'jarlabels' }, // labels and jar labels
    { type: 'pantry', kind: 'chalkboard' }, // inventory list
    { type: 'pantry', kind: 'apronhook' }, // hooks for aprons
    { type: 'pantry', kind: 'apothecary', count: 2 },
    { type: 'pantry', kind: 'spicerack' },
    { type: 'archlight', kind: 'ledstrip' }, // under-shelf lighting
    { type: 'walldecor', kind: 'shelf' },
  ],
  closet: [
    // Furniture — storage is the point, but a walk-in still needs floor to stand
    // on, so the runs stay modest.
    { type: 'closet', kind: 'closetshelf', count: 2 }, // custom shelving
    { type: 'closet', kind: 'rod2' }, // hanging rods, single and double
    { type: 'closet', kind: 'shoerack' },
    { type: 'closet', kind: 'closetdrawer' }, // drawer units
    { type: 'closet', kind: 'closetisland' }, // centre island
    { type: 'closet', kind: 'valet' }, // valet stand
    // Design objects.
    { type: 'closet', kind: 'fullmirror' },
    { type: 'closet', kind: 'closetlight', count: 2 }, // closet lighting
    { type: 'closet', kind: 'divider' }, // drawer dividers
    { type: 'closet', kind: 'hanger' }, // velvet hangers
    { type: 'closet', kind: 'jewelorganiser' },
    { type: 'functional', kind: 'laundry' }, // laundry hamper
    { type: 'closet', kind: 'closetbench' },
    { type: 'closet', kind: 'perftray' },
    { type: 'closet', kind: 'belt' }, // scarf / belt hooks
  ],
};


/**
 * Ensure every room gets at least one ceiling light.
 *
 * Rooms are lit from above in reality, and it is the cheapest thing that makes
 * a layout read as a room rather than a floorplan. Several presets name one
 * explicitly, but relying on each list to remember is how one gets forgotten —
 * so this is applied to the finished step list rather than left to the lists.
 * A ceiling step already present is left alone, which keeps a chandelier over
 * a dining table from being topped up with a second, plainer fitting.
 */
export function withCeilingLight(steps: PresetStep[]): PresetStep[] {
  if (steps.some((s) => s.type === 'ceilight')) return steps;
  // A room with nothing but wall lamps and lamps on the floor still needs one.
  return [...steps, { type: 'ceilight', kind: 'flush' }];
}


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

/**
 * Words in a room description that mean "use this category of object", with the
 * maximum number of each that may be added. A description is free text written
 * by hand, so this is deliberately a short list of unambiguous terms rather
 * than anything clever: "desk" means a desk, "plant" means greenery. Anything
 * unrecognised is ignored, which leaves the room's purpose in charge.
 */
const NOTE_TERMS: { re: RegExp; steps: PresetStep[] }[] = [
  { re: /\b(sofa|couch|settee)\b/, steps: [{ type: 'seating', kind: 'sofa' }] },
  { re: /\b(armchair|accent chair|lounge chair)\b/, steps: [{ type: 'seating', kind: 'accent' }] },
  { re: /\b(dining chair|chair)s?\b/, steps: [{ type: 'seating', kind: 'dining', count: 2 }] },
  { re: /\b(bed|bedside|double bed|single bed)\b/, steps: [{ type: 'beds' }] },
  { re: /\b(nightstand|bedside table)\b/, steps: [{ type: 'storage', kind: 'nightstand' }] },
  { re: /\b(desk|workspace|study)\b/, steps: [{ type: 'tables', kind: 'desk' }] },
  { re: /\b(bookcase|books|shelving|shelves)\b/, steps: [{ type: 'storage', kind: 'bookcase' }] },
  { re: /\b(tv|television|screen)\b/, steps: [{ type: 'functional', kind: 'media' }] },
  { re: /\b(fireplace)\b/, steps: [{ type: 'functional', kind: 'fireplace' }] },
  { re: /\b(rug|carpet)\b/, steps: [{ type: 'textiles', kind: 'arearug' }] },
  { re: /\b(plant|greenery|fern)\b/, steps: [{ type: 'floorplants' }] },
  { re: /\b(lamp|lighting|lantern)\b/, steps: [{ type: 'floorlamp' }] },
  { re: /\b(pendant|chandelier)\b/, steps: [{ type: 'ceilight', kind: 'pendant' }] },
  { re: /\b(sconce)\b/, steps: [{ type: 'walllight' }] },
  { re: /\b(art|artwork|painting|print)\b/, steps: [{ type: 'walldecor', kind: 'artwork' }] },
  { re: /\b(mirror)\b/, steps: [{ type: 'walldecor', kind: 'mirror' }] },
  { re: /\b(curtain|curtains|drape|blind)\b/, steps: [{ type: 'walldecor', kind: 'curtain' }] },
  { re: /\b(wardrobe|dresser|sideboard|credenza)\b/, steps: [{ type: 'storage', kind: 'sideboard' }] },
  { re: /\b(fridge|refrigerator|freezer)\b/, steps: [{ type: 'kitchen', kind: 'fridge' }] },
  { re: /\b(island|peninsula|breakfast bar)\b/, steps: [{ type: 'kitchen', kind: 'island' }] },
  { re: /\b(sink|basin)\b/, steps: [{ type: 'kitchen', kind: 'sinkbase' }] },
  { re: /\b(cooktop|hob|stove|oven|range)\b/, steps: [{ type: 'kitchen', kind: 'range' }] },
  { re: /\b(dining table|table for)\b/, steps: [{ type: 'dining', kind: 'dining' }] },
  { re: /\b(bath|tub|bathtub)\b/, steps: [{ type: 'bathtub' }] },
  { re: /\b(shower)\b/, steps: [{ type: 'shower' }] },
  { re: /\b(toilet|wc)\b/, steps: [{ type: 'toilet' }] },
  { re: /\b(vanity)\b/, steps: [{ type: 'vanity' }] },
  { re: /\b(towel)\b/, steps: [{ type: 'towelrack' }] },
  { re: /\b(hamper|laundry|basket)\b/, steps: [{ type: 'functional', kind: 'basket' }] },
];

/**
 * Turn a free-text room description into extra placement steps.
 *
 * The room's purpose decides the baseline layout; the description adds to it,
 * so the terms that merely restate the purpose ("kitchen" in a kitchen) are
 * skipped — otherwise a kitchen that mentions "dining table" would gain one
 * regardless of the preset's judgement. Explicit requests, including the ones
 * that contradict the purpose, are always honoured: a kitchen described as
 * "no dining table" should not get one, and a bedroom that says "desk" should.
 */
export function stepsFromNote(note: string, kind?: RoomKind): PresetStep[] {
  const raw = (note ?? '').toLowerCase();
  if (!raw.trim()) return [];
  // "no dining table" must not place a dining table. Negations are stripped
  // before matching, so anything named in a negative phrase is ignored.
  // Everything from a negation up to the next clause is dropped, so
  // "without a sofa but needs a desk" removes the sofa and keeps the desk.
  const text = raw.replace(
    /\b(?:no|without|avoid|not|don'?t|doesn'?t|skip(?:ping)?|leave\s+out)\b[^,;.]*/g,
    ' ',
  );

  // What the purpose already asks for, so restating it changes nothing.
  const baseline = new Set(
    (kind ? PRESETS[kind] ?? [] : []).map((s) => `${s.type}:${s.kind ?? ''}`),
  );

  const out: PresetStep[] = [];
  const seen = new Set<string>();
  for (const { re, steps } of NOTE_TERMS) {
    if (!re.test(text)) continue;
    for (const s of steps) {
      const key = `${s.type}:${s.kind ?? ''}`;
      if (seen.has(key) || baseline.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out.slice(0, 6);
}
