// Central app state (zustand).

import { create } from 'zustand';
import { ITEM_INDEX, LIBRARY } from './data/items';
import { distPointSeg, polyArea, polyCentroid, rotatedSize } from './logic/geometry';
import { blockWall, buildGrid, CELL, type Grid } from './logic/grid';
import {
  canPlace,
  findBestSpot,
  nextWallSpot,
  projectToWall,
  PRESETS,
  refineLayout,
  type EdgeInfo,
} from './logic/placement';
import { activateLicense, getLicense, startCheckout } from './lib/checkout';
import { CLEARANCE, RULES } from './logic/rules';
import type {
  BuiltWall,
  EdgeKind,
  FurnItem,
  PlacedItem,
  RoomKind,
  Tier,
  Vec2,
  ViewMode,
} from './types';
import { tierUnlocked } from './types';

let uidSeq = 0;
const nextUid = () => `p${++uidSeq}-${Date.now().toString(36)}`;
let wallSeq = 0;
const nextWallId = () => `w${++wallSeq}-${Date.now().toString(36)}`;

/**
 * Placement grid for a room with built walls: partition cells become blocked so
 * new furniture (and AI Fill) refuses to land on them. Door edges additionally
 * block a 36 in (0.91 m) approach zone — the door swing plus the entry path
 * (rules 1, 2, 17, 126) — so nothing can be dropped in front of a door.
 */
function makeGrid(room: Vec2[], walls: BuiltWall[], openings: EdgeKind[] = []): Grid {
  const g = buildGrid(room);
  for (const w of walls) blockWall(g, w.a, w.b);
  for (let i = 0; i < room.length; i++) {
    if ((openings[i] ?? 'wall') === 'door') {
      blockWall(g, room[i], room[(i + 1) % room.length], CLEARANCE.doorApproach);
    }
  }
  for (const w of walls) {
    if (w.kind === 'door') blockWall(g, w.a, w.b, CLEARANCE.doorApproach);
  }
  return g;
}

/** Room edges + built partitions, so wall-mounted art/sconces can use either. */
export function edgesOf(poly: Vec2[], openings: EdgeKind[], walls: BuiltWall[] = []): EdgeInfo[] {
  const base = poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length], kind: openings[i] ?? 'wall' }));
  return [...base, ...walls.map((w) => ({ a: w.a, b: w.b, kind: w.kind }))];
}

/** Suggest one window (longest edge) and one door (shortest edge). */
function suggestOpenings(poly: Vec2[]): EdgeKind[] {
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

interface Project {
  room: Vec2[];
  openings: EdgeKind[];
  items: PlacedItem[];
  roomKind: RoomKind;
  walls: BuiltWall[];
}

const DEMO_ROOM: Project = {
  room: [
    { x: 0, y: 0 },
    { x: 5.6, y: 0 },
    { x: 5.6, y: 4.2 },
    { x: 2.2, y: 4.2 },
    { x: 2.2, y: 5.4 },
    { x: 0, y: 5.4 },
  ],
  openings: ['window', 'wall', 'wall', 'door', 'wall', 'wall'],
  items: [],
  roomKind: 'living',
  walls: [],
};

export interface AppState {
  tier: Tier;
  mode: ViewMode;
  draft: Vec2[] | null; // polygon currently being drawn
  room: Vec2[] | null;
  openings: EdgeKind[];
  grid: Grid | null;
  items: PlacedItem[];
  selected: string | null;
  roomKind: RoomKind;
  edgeEdit: boolean;
  /** Free-built partitions (🧱 tool), independent of the room outline. */
  walls: BuiltWall[];
  wallBuild: boolean;
  /** Chain of snapped points for the wall currently being drawn. */
  wallDraft: Vec2[] | null;
  /**
   * Angle (rad) of the wall the current chain is drawn from; null = started on
   * free ground (falls back to the global 45° axes). Every segment of the
   * chain snaps to `wallRef + k*45°`, so new walls stay parallel / square to
   * the wall they were started from.
   */
  wallRef: number | null;
  upgradeOpen: boolean;
  welcomeOpen: boolean;
  checkingOut: boolean;
  toast: string | null;

  toastMsg: (m: string) => void;
  setMode: (m: ViewMode) => void;
  setTier: (t: Tier) => void;
  setRoomKind: (k: RoomKind) => void;
  setEdgeEdit: (v: boolean) => void;
  setWallBuild: (v: boolean) => void;
  addWallPoint: (p: Vec2) => void;
  finishWallDraft: () => void;
  removeWall: (id: string) => void;
  select: (uid: string | null) => void;
  setUpgradeOpen: (v: boolean) => void;
  setWelcomeOpen: (v: boolean) => void;

  addDraftPoint: (p: Vec2) => void;
  cancelDraft: () => void;
  closeDraft: () => void;
  clearRoom: () => void;

  addItem: (itemId: string) => void;
  tryMove: (uid: string, x: number, y: number) => boolean;
  rotateSelected: () => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  setColorIdx: (uid: string, idx: number) => void;
  cycleEdge: (idx: number) => void;

  aiFill: () => void;
  clearItems: () => void;

  checkout: (tier: 'pro' | 'max') => Promise<void>;
  handleCheckoutReturn: () => Promise<void>;
  saveProject: () => void;
  loadProject: () => void;
  loadDemo: () => void;
}

function toast(get: () => AppState, set: (s: Partial<AppState>) => void, m: string) {
  set({ toast: m });
  window.clearTimeout((toast as any)._t);
  (toast as any)._t = window.setTimeout(() => {
    if (get().toast === m) set({ toast: null });
  }, 2800);
}

/** Squared distance between two points. */
function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Every wall line: room outline edges + built partitions. */
function wallSegments(room: Vec2[] | null, walls: BuiltWall[]): { a: Vec2; b: Vec2 }[] {
  const segs: { a: Vec2; b: Vec2 }[] = [];
  if (room) {
    for (let i = 0; i < room.length; i++) segs.push({ a: room[i], b: room[(i + 1) % room.length] });
  }
  for (const w of walls) segs.push({ a: w.a, b: w.b });
  return segs;
}

/** Nearest vertex of `verts` to p within maxD, or null. */
function nearestVert(p: Vec2, verts: Vec2[], maxD: number): Vec2 | null {
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
function projectOnSeg(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** Wall segment whose line passes closest to p (within maxD), or null. */
function nearestWallLine(
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
function raySegHit(A: Vec2, dir: Vec2, c: Vec2, e: Vec2): Vec2 | null {
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
function rayWallHit(
  anchor: Vec2,
  dir: Vec2,
  room: Vec2[] | null,
  walls: BuiltWall[],
  p: Vec2,
  maxD: number,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = maxD;
  for (const s of wallSegments(room, walls)) {
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
 * Where a wall chain should start, plus the angle of the wall it is drawn
 * from. Priority: exact vertex → projection onto the wall under the cursor
 * (the new wall then aligns to it) → free 0.25 m grid start (no source wall).
 */
function startWallPoint(p: Vec2, room: Vec2[] | null, walls: BuiltWall[]): { pt: Vec2; ref: number | null } {
  const segs = wallSegments(room, walls);
  // 1) Room corner / wall endpoint — the strongest connection.
  const v = nearestVert(p, [...(room ?? []), ...walls.flatMap((w) => [w.a, w.b])], 0.3);
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

/**
 * Snap a wall click. Vertices win (corners make the cleanest joints). With a
 * chain in progress the direction locks to `ref + k*45°` — parallel, square or
 * diagonal to the wall the chain was started from — lengths round to 0.25 m,
 * and the point lands exactly on any wall the aligned ray crosses close to the
 * click. Exported so the canvas can preview exactly where a click will land.
 */
export function snapWallPoint(
  p: Vec2,
  room: Vec2[] | null,
  walls: BuiltWall[],
  chain: Vec2[],
  ref: number | null,
): Vec2 {
  const SNAP = 0.25;
  const verts: Vec2[] = [...(room ?? [])];
  for (const w of walls) verts.push(w.a, w.b);
  verts.push(...chain);
  const best = nearestVert(p, verts, 0.3);
  if (best) return { x: best.x, y: best.y };

  // Starting fresh: fall back to the start rules (wall projection / grid).
  if (!chain.length) return startWallPoint(p, room, walls).pt;

  const anchor = chain[chain.length - 1];
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0.2) {
    return { x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP };
  }

  // Lock the direction to the source wall's lattice: ref + k*45°.
  const base = ref ?? 0;
  const ang = base + Math.round((Math.atan2(dy, dx) - base) / (Math.PI / 4)) * (Math.PI / 4);
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };

  // Terminating exactly on a wall the aligned ray crosses close to the click
  // beats rounding — a partition meets the wall it was aimed at cleanly
  // (T-junction), and the result is still within 0.4 m of the raw click.
  const hit = rayWallHit(anchor, dir, room, walls, p, 0.4);
  if (hit) return hit;

  // Round the length (never x/y) so rotated chains stay exactly on the axis.
  const len2 = Math.max(SNAP, Math.round(len / SNAP) * SNAP);
  return { x: anchor.x + dir.x * len2, y: anchor.y + dir.y * len2 };
}

export const useStore = create<AppState>((set, get) => ({
  tier: 'free',
  mode: 'draw',
  draft: null,
  room: null,
  openings: [],
  grid: null,
  items: [],
  selected: null,
  roomKind: 'living',
  edgeEdit: false,
  walls: [],
  wallBuild: false,
  wallDraft: null,
  wallRef: null,
  upgradeOpen: false,
  welcomeOpen: true,
  checkingOut: false,
  toast: null,

  toastMsg: (m) => toast(get, set, m),
  setMode: (m) => {
    const { room, grid } = get();
    if ((m === 'furnish' || m === '3d') && (!room || !grid)) {
      toast(get, set, 'Draw a room first — click to place corners, then click the first point.');
      set({ mode: 'draw' });
      return;
    }
    // Commit any in-progress wall chain before leaving the 2D view.
    if (m === '3d' && get().wallDraft) get().finishWallDraft();
    set({
      mode: m,
      selected: m === '3d' ? null : get().selected,
      ...(m === '3d' ? { wallBuild: false, wallDraft: null, wallRef: null } : {}),
    });
  },
  setTier: (t) => set({ tier: t }),
  setRoomKind: (k) => set({ roomKind: k }),
  setEdgeEdit: (v) => {
    if (v && get().wallDraft) get().finishWallDraft();
    set(v ? { edgeEdit: true, wallBuild: false, wallDraft: null, wallRef: null } : { edgeEdit: false });
  },

  // -------------------------------------------------------------- 🧱 walls
  setWallBuild: (v) => {
    if (!v && get().wallDraft) get().finishWallDraft();
    set(
      v
        ? { wallBuild: true, wallDraft: null, wallRef: null, edgeEdit: false, selected: null }
        : { wallBuild: false, wallDraft: null, wallRef: null },
    );
  },
  addWallPoint: (p) => {
    const st = get();
    if (!st.wallBuild) return;
    const pts = st.wallDraft ?? [];

    // Start a new chain — remember which wall it is drawn from, so every
    // segment of the chain stays aligned to that wall.
    if (!pts.length) {
      const { pt, ref } = startWallPoint(p, st.room, st.walls);
      set({ wallDraft: [pt], wallRef: ref });
      toast(
        get,
        set,
        ref !== null
          ? 'Wall started — every segment aligns to the wall you began from. Esc finishes.'
          : 'Wall started — click to extend, click the first point to close, Esc to finish.',
      );
      return;
    }

    const first = pts[0];

    // Clicking the first point closes the loop.
    if (pts.length >= 3 && dist2(p, first) < 0.4 * 0.4) {
      const walls = [...st.walls];
      for (let i = 1; i < pts.length; i++) {
        walls.push({ id: nextWallId(), a: pts[i - 1], b: pts[i], kind: 'wall' });
      }
      walls.push({ id: nextWallId(), a: pts[pts.length - 1], b: first, kind: 'wall' });
      set({ wallDraft: null, wallRef: null, walls, grid: st.room ? makeGrid(st.room, walls, st.openings) : st.grid });
      toast(get, set, 'Wall loop closed.');
      return;
    }

    const q = snapWallPoint(p, st.room, st.walls, pts, st.wallRef);
    const last = pts[pts.length - 1];
    if (dist2(q, last) < 0.2 * 0.2) return; // ignore tiny segments
    // Clicking back on the start point ends the chain (needs >= 2 segments).
    if (dist2(q, first) < 0.05 * 0.05 && pts.length >= 2) {
      get().finishWallDraft();
      return;
    }
    set({ wallDraft: [...pts, q] });
  },
  finishWallDraft: () => {
    const st = get();
    if (!st.wallDraft) return;
    const pts = st.wallDraft;
    if (pts.length >= 2) {
      const walls = [...st.walls];
      for (let i = 1; i < pts.length; i++) {
        walls.push({ id: nextWallId(), a: pts[i - 1], b: pts[i], kind: 'wall' });
      }
      set({ wallDraft: null, wallRef: null, walls, grid: st.room ? makeGrid(st.room, walls, st.openings) : st.grid });
      toast(get, set, 'Wall finished.');
    } else {
      set({ wallDraft: null, wallRef: null });
    }
  },
  removeWall: (id) => {
    const st = get();
    const walls = st.walls.filter((w) => w.id !== id);
    set({ walls, grid: st.room ? makeGrid(st.room, walls, st.openings) : st.grid });
  },
  select: (uid) => set({ selected: uid }),
  setUpgradeOpen: (v) => set({ upgradeOpen: v }),
  setWelcomeOpen: (v) => set({ welcomeOpen: v }),

  addDraftPoint: (p) => {
    const draft = get().draft ?? [];
    if (draft.length >= 3) {
      const first = draft[0];
      if (Math.hypot(p.x - first.x, p.y - first.y) < 0.45) {
        set({ draft: [...draft] });
        get().closeDraft();
        return;
      }
    }
    set({ draft: [...draft, p] });
  },
  cancelDraft: () => set({ draft: null }),
  closeDraft: () => {
    const draft = get().draft;
    if (!draft || draft.length < 3) {
      toast(get, set, 'A room needs at least 3 corners.');
      return;
    }
    const area = polyArea(draft);
    if (area < 4) {
      toast(get, set, 'Room is too small — aim for at least 4 m².');
      return;
    }
    const openings = suggestOpenings(draft);
    const grid = makeGrid(draft, get().walls, openings);
    set({ room: draft, draft: null, openings, grid, mode: 'furnish', items: [], selected: null });
    toast(
      get,
      set,
      `Room ready — ${area.toFixed(1)} m². Click library items or run AI Fill.`,
    );
  },
  clearRoom: () =>
    set({
      room: null,
      draft: null,
      openings: [],
      grid: null,
      items: [],
      selected: null,
      mode: 'draw',
      edgeEdit: false,
      walls: [],
      wallDraft: null,
      wallRef: null,
      wallBuild: false,
    }),

  addItem: (itemId) => {
    const st = get();
    const item = ITEM_INDEX.get(itemId);
    if (!item) return;
    if (!st.grid || !st.room) {
      toast(get, set, 'Draw a room first.');
      return;
    }
    if (!tierUnlocked(item.tier, st.tier)) {
      set({ upgradeOpen: true });
      return;
    }
    const spot = findBestSpot(
      st.grid,
      st.room,
      st.items,
      ITEM_INDEX,
      item,
      edgesOf(st.room, st.openings, st.walls),
    );
    if (!spot) {
      toast(get, set, `No room for the ${item.name} — remove something first.`);
      return;
    }
    const placed: PlacedItem = {
      uid: nextUid(),
      itemId,
      x: spot.x,
      y: spot.y,
      rot: spot.rot,
      colorIdx: 0,
    };
    set({ items: [...st.items, placed], selected: placed.uid });
    toast(get, set, `${item.name} placed.`);
  },

  tryMove: (uid, x, y) => {
    const st = get();
    if (!st.grid || !st.room) return false;
    const target = st.items.find((i) => i.uid === uid);
    if (!target) return false;
    const item = ITEM_INDEX.get(target.itemId);
    if (!item) return false;
    const edges = edgesOf(st.room, st.openings, st.walls);

    if (item.mount === 'wall') {
      // Wall pieces snap onto the nearest non-door wall.
      const spot = projectToWall(st.room, edges, item, x, y);
      if (!spot) return false;
      if (!canPlace(st.grid, st.room, st.items, ITEM_INDEX, item, spot.x, spot.y, spot.rot, uid))
        return false;
      set({
        items: st.items.map((i) => (i.uid === uid ? { ...i, x: spot.x, y: spot.y, rot: spot.rot } : i)),
      });
      return true;
    }

    const sx = Math.round(x / 0.25) * 0.25;
    const sy = Math.round(y / 0.25) * 0.25;
    if (item.mount === 'ceiling') {
      // Ceiling pieces may not collide with each other.
      const clash = st.items.some((o) => {
        if (o.uid === uid) return false;
        const of = ITEM_INDEX.get(o.itemId);
        return (
          of &&
          of.mount === 'ceiling' &&
          Math.hypot(o.x - sx, o.y - sy) < ((of.w + item.w) / 2) * 0.8
        );
      });
      if (clash) return false;
    }
    if (!canPlace(st.grid, st.room, st.items, ITEM_INDEX, item, sx, sy, target.rot, uid)) return false;
    set({
      items: st.items.map((i) => (i.uid === uid ? { ...i, x: sx, y: sy } : i)),
    });
    return true;
  },

  rotateSelected: () => {
    const st = get();
    if (!st.selected || !st.grid || !st.room) return;
    const target = st.items.find((i) => i.uid === st.selected);
    if (!target) return;
    const item = ITEM_INDEX.get(target.itemId);
    if (!item) return;
    const edges = edgesOf(st.room, st.openings, st.walls);

    if (item.mount === 'wall') {
      // Wall pieces hop to the next wall that fits.
      const spot = nextWallSpot(st.room, st.items, ITEM_INDEX, item, edges, target.x, target.y);
      if (!spot) {
        toast(get, set, 'No other wall fits this piece.');
        return;
      }
      set({
        items: st.items.map((i) =>
          i.uid === target.uid ? { ...i, x: spot.x, y: spot.y, rot: spot.rot } : i,
        ),
      });
      toast(get, set, 'Moved to the next wall.');
      return;
    }

    const rot = target.rot + 90;
    if (!canPlace(st.grid, st.room, st.items, ITEM_INDEX, item, target.x, target.y, rot, target.uid)) {
      toast(get, set, "Can't rotate there — not enough space.");
      return;
    }
    set({ items: st.items.map((i) => (i.uid === target.uid ? { ...i, rot } : i)) });
  },

  duplicateSelected: () => {
    const st = get();
    if (!st.selected || !st.grid || !st.room) return;
    const target = st.items.find((i) => i.uid === st.selected);
    if (!target) return;
    const item = ITEM_INDEX.get(target.itemId);
    if (!item) return;
    const spot = findBestSpot(
      st.grid,
      st.room,
      st.items,
      ITEM_INDEX,
      item,
      edgesOf(st.room, st.openings, st.walls),
      { rotations: [target.rot, ((target.rot + 90) % 360) as 0 | 90] },
    );
    if (!spot) {
      toast(get, set, 'No space for another one.');
      return;
    }
    const copy: PlacedItem = { ...target, uid: nextUid(), x: spot.x, y: spot.y, rot: spot.rot };
    set({ items: [...st.items, copy], selected: copy.uid });
    toast(get, set, `${item.name} duplicated.`);
  },

  removeSelected: () => {
    const st = get();
    if (!st.selected) return;
    set({ items: st.items.filter((i) => i.uid !== st.selected), selected: null });
  },

  setColorIdx: (uid, idx) => {
    const st = get();
    const target = st.items.find((i) => i.uid === uid);
    if (!target) return;
    const item = ITEM_INDEX.get(target.itemId);
    if (!item) return;
    if (idx > 0 && st.tier !== 'max') {
      set({ upgradeOpen: true });
      toast(get, set, 'Colour swaps are a Max feature.');
      return;
    }
    set({ items: st.items.map((i) => (i.uid === uid ? { ...i, colorIdx: idx } : i)) });
  },

  cycleEdge: (idx) => {
    const st = get();
    if (!st.room) return;
    const order: EdgeKind[] = ['wall', 'window', 'door'];
    const cur = st.openings[idx] ?? 'wall';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    const openings = st.openings.map((o, i) => (i === idx ? next : o));
    // Rebuild the grid so a new door edge blocks its swing + entry path.
    set({ openings, grid: makeGrid(st.room, st.walls, openings) });
    toast(get, set, `Edge → ${next}`);
  },

  aiFill: () => {
    const st = get();
    if (!st.grid || !st.room) {
      toast(get, set, 'Draw a room first.');
      return;
    }
    const steps = PRESETS[st.roomKind];
    const edges = edgesOf(st.room, st.openings, st.walls);
    let placed = 0;
    let skipped = 0;
    const items: PlacedItem[] = [];

    for (const step of steps) {
      const count = step.count ?? 1;
      for (let c = 0; c < count; c++) {
        // Unlocked candidates, preferring the requested kind.
        let pool = LIBRARY.filter(
          (i) => i.type === step.type && tierUnlocked(i.tier, st.tier),
        );
        if (!pool.length) continue;
        if (step.kind) {
          const exact = pool.filter((i) => i.kind === step.kind);
          if (exact.length) pool = exact;
        }
        // R22 — the coffee table should be 1/2 to 2/3 the length of the sofa.
        if (step.kind === 'coffee') {
          const sofa = items.find((it) => ITEM_INDEX.get(it.itemId)?.kind === 'sofa');
          if (sofa) {
            const sf = ITEM_INDEX.get(sofa.itemId)!;
            const fit = pool.filter(
              (i) => i.w >= CLEARANCE.coffeeLenMin * sf.w && i.w <= CLEARANCE.coffeeLenMax * sf.w,
            );
            if (fit.length) pool = fit;
          }
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const spot = findBestSpot(st.grid, st.room, items, ITEM_INDEX, pick, edges);
        if (!spot) {
          skipped++;
          continue;
        }
        items.push({ uid: nextUid(), itemId: pick.id, x: spot.x, y: spot.y, rot: spot.rot, colorIdx: 0 });
        placed++;
      }
    }
    // Post-pass: apply the relational design rules (conversation circle,
    // coffee-table gap, nightstands, art placement, rug anchoring, …).
    refineLayout(st.grid, st.room, items, ITEM_INDEX, edges);
    set({ items, selected: null });
    toast(
      get,
      set,
      skipped
        ? `AI placed ${placed} items (${skipped} didn't fit — try a bigger room).`
        : `AI placed ${placed} items using the ${RULES.length}-rule design guide. Drag to fine-tune, tap one to swap.`,
    );
  },

  clearItems: () => set({ items: [], selected: null }),

  checkout: async (tier) => {
    if (get().checkingOut) return;
    set({ checkingOut: true });
    const res = await startCheckout(tier);
    set({ checkingOut: false });
    if (res === 'demo') {
      set({ tier, upgradeOpen: false });
      toast(get, set, `Demo checkout — ${tier === 'pro' ? 'Pro' : 'Max'} unlocked!`);
    } else if (res === 'error') {
      toast(get, set, 'Checkout failed — check your Paddle keys.');
    }
    // 'redirect' navigates away to Paddle Checkout.
  },

  // Called on app load: if we just returned from Paddle (?checkoutId=...),
  // verify the checkout server-side and activate the tier from the license.
  handleCheckoutReturn: async () => {
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get('checkoutId');
    if (!checkoutId) return;

    const res = await activateLicense(checkoutId);
    if (res === 'ok') {
      const license = getLicense();
      if (license?.tier) {
        set({ tier: license.tier, upgradeOpen: false });
        toast(get, set, `${license.tier === 'pro' ? 'Pro' : 'Max'} activated — enjoy!`);
      }
    } else {
      toast(get, set, 'Activation failed — your payment may still be processing.');
    }
    // Clean the URL so a refresh doesn't re-activate.
    window.history.replaceState({}, '', window.location.pathname);
  },

  saveProject: () => {
    const st = get();
    if (!st.room) {
      toast(get, set, 'Nothing to save yet.');
      return;
    }
    const data: Project = {
      room: st.room,
      openings: st.openings,
      items: st.items,
      roomKind: st.roomKind,
      walls: st.walls,
    };
    localStorage.setItem('roomcraft:project', JSON.stringify(data));
    toast(get, set, 'Project saved to this browser.');
  },

  loadProject: () => {
    const raw = localStorage.getItem('roomcraft:project');
    if (!raw) {
      toast(get, set, 'No saved project found.');
      return;
    }
    try {
      const data = JSON.parse(raw) as Project;
      const walls = data.walls ?? [];
      const grid = makeGrid(data.room, walls, data.openings);
      set({
        room: data.room,
        openings: data.openings,
        items: data.items,
        roomKind: data.roomKind,
        walls,
        grid,
        mode: 'furnish',
        selected: null,
        draft: null,
        wallDraft: null,
        wallRef: null,
        wallBuild: false,
      });
      toast(get, set, 'Project loaded.');
    } catch {
      toast(get, set, 'Saved project is corrupted.');
    }
  },

  loadDemo: () => {
    const walls = [...DEMO_ROOM.walls];
    const grid = makeGrid(DEMO_ROOM.room, walls, DEMO_ROOM.openings);
    set({
      room: DEMO_ROOM.room,
      openings: [...DEMO_ROOM.openings],
      items: [],
      roomKind: DEMO_ROOM.roomKind,
      walls,
      grid,
      draft: null,
      selected: null,
      welcomeOpen: false,
      mode: 'furnish',
      edgeEdit: false,
      wallDraft: null,
      wallRef: null,
      wallBuild: false,
    });
    // Fill after state commit.
    setTimeout(() => get().aiFill(), 30);
  },
}));

// Debug/verification hook: inspect app state from the console.
if (typeof window !== 'undefined') {
  (window as any).__rcStore = useStore;
  (window as any).__rcLib = LIBRARY;
}

/** Convenience selectors. */
export const selectArea = (s: AppState) => (s.room ? polyArea(s.room) : 0);
export const selectCentroid = (s: AppState) => (s.room ? polyCentroid(s.room) : { x: 0, y: 0 });
export { CELL, rotatedSize };
