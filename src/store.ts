// Central app state (zustand).

import { create } from 'zustand';
import { ITEM_INDEX, LIBRARY } from './data/items';
import {
  cleanPolygon,
  distPointSeg,
  pointInPoly,
  polyArea,
  polyCentroid,
  polysOverlap,
  rotatedSize,
} from './logic/geometry';
import { blockWall, buildGridFor, CELL, type Grid } from './logic/grid';
import { findEnclosedFaces } from './logic/enclose';
import {
  CLOSE_RADIUS,
  dist2,
  snapWallPoint,
  startWallPoint,
  suggestOpenings,
  wallSegments,
  type WallSnapMode,
} from './logic/wallsnap';
import {
  canPlace,
  canPlaceManual,
  canPlaceRaw,
  findBestSpot,
  nextWallSpot,
  projectToWall,
  PRESETS,
  refineLayout,
  ROOM_LABEL,
  stepsFromNote,
  withCeilingLight,
  coverageBudget,
  floorPieceLimit,
  isFlat,
  oddCount,
  ceilingLightsFor,
  COVERAGE_FLOOR,
  DUPLICATE_FREE_AREA_MAX,
  type EdgeInfo,
  type PresetStep,
} from './logic/placement';
import { repeatable } from './logic/roomrules';
import { activateLicense, getLicense, startCheckout } from './lib/checkout';
import { CLEARANCE, RULES } from './logic/rules';
import type {
  BuiltWall,
  EdgeKind,
  FurnItem,
  PlacedItem,
  Room,
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
function makeGrid(rooms: Room[], walls: BuiltWall[]): Grid {
  const g = buildGridFor(rooms.map((r) => r.poly));
  for (const w of walls) blockWall(g, w.a, w.b);
  for (const r of rooms) {
    for (let i = 0; i < r.poly.length; i++) {
      if ((r.openings[i] ?? 'wall') === 'door') {
        blockWall(g, r.poly[i], r.poly[(i + 1) % r.poly.length], CLEARANCE.doorApproach);
      }
    }
  }
  for (const w of walls) {
    if (w.kind === 'door') blockWall(g, w.a, w.b, CLEARANCE.doorApproach);
  }
  return g;
}

/** Room edges + built partitions, so wall-mounted art/sconces can use either. */
/**
 * A door is an opening, not a picture of a door hung on the wall.
 *
 * When one lands on a wall it turns that stretch of wall into an opening —
 * jambs and a head with a hole between — so the leaf fills a real gap instead
 * of sitting on solid plaster. Returns the rooms with the edge converted, or
 * unchanged when the door is not close enough to a wall to be in one.
 */
function doorEdgeIndex(poly: Vec2[], x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const d = distPointSeg({ x, y }, poly[i], poly[(i + 1) % poly.length]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return bestD <= 0.5 ? best : -1;
}

function withDoorOpening(rooms: Room[], roomId: string, x: number, y: number): Room[] {
  return rooms.map((r) => {
    if (r.id !== roomId) return r;
    const i = doorEdgeIndex(r.poly, x, y);
    if (i < 0) return r;
    if (r.openings[i] === 'door') return r;
    return { ...r, openings: r.openings.map((o, k) => (k === i ? 'door' : o)) };
  });
}

/**
 * Put a wall back if the last door standing in its opening has gone, so deleting
 * a door does not leave a hole with nothing in it.
 *
 * Only the one edge the door occupied is considered. A room's openings are
 * seeded with a suggested door that no door object has claimed, and sweeping
 * every door-looking edge would close those too — turning one deletion into a
 * plan-wide rewrite.
 */
function releaseDoorEdge(
  rooms: Room[],
  roomId: string,
  x: number,
  y: number,
  remaining: PlacedItem[],
): Room[] {
  return rooms.map((r) => {
    if (r.id !== roomId) return r;
    const idx = doorEdgeIndex(r.poly, x, y);
    if (idx < 0 || r.openings[idx] !== 'door') return r;
    const stillThere = remaining.some((it) => {
      if (it.roomId !== r.id) return false;
      if (ITEM_INDEX.get(it.itemId)?.type !== 'doors') return false;
      return doorEdgeIndex(r.poly, it.x, it.y) === idx;
    });
    if (stillThere) return r;
    return { ...r, openings: r.openings.map((o, k) => (k === idx ? 'wall' : o)) };
  });
}

export function edgesOf(poly: Vec2[], openings: EdgeKind[], walls: BuiltWall[] = []): EdgeInfo[] {
  const base = poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length], kind: openings[i] ?? 'wall' }));
  return [...base, ...walls.map((w) => ({ a: w.a, b: w.b, kind: w.kind }))];
}

/** Suggest one window (longest edge) and one door (shortest edge). */
/**
 * Saved-project format. v1 stored a single `room`; v2 stores every room on the
 * plan. Loading accepts both so projects saved by earlier builds still open.
 */
interface ProjectV1 {
  room: Vec2[];
  openings: EdgeKind[];
  items: PlacedItem[];
  roomKind: RoomKind;
  walls: BuiltWall[];
}

interface ProjectV2 {
  rooms: Room[];
  items: PlacedItem[];
  walls: BuiltWall[];
  activeRoomId: string | null;
}

type Project = ProjectV1 | ProjectV2;

const DEMO_ROOMS: Room[] = [
  {
    id: 'demo-living',
    poly: [
      { x: 0, y: 0 },
      { x: 5.6, y: 0 },
      { x: 5.6, y: 4.2 },
      { x: 2.2, y: 4.2 },
      { x: 2.2, y: 5.4 },
      { x: 0, y: 5.4 },
    ],
    openings: ['window', 'wall', 'wall', 'door', 'wall', 'wall'],
    kind: 'living',
    name: '',
    note: '',
  },
  {
    id: 'demo-kitchen',
    poly: [
      { x: 6.4, y: 0 },
      { x: 10.6, y: 0 },
      { x: 10.6, y: 3.8 },
      { x: 6.4, y: 3.8 },
    ],
    openings: ['window', 'wall', 'window', 'door'],
    kind: 'kitchen',
    name: '',
    note: '',
  },
];

const DEMO_WALLS: BuiltWall[] = [];

export interface AppState {
  tier: Tier;
  mode: ViewMode;
  draft: Vec2[] | null; // polygon currently being drawn
  /** Every enclosed space on the plan. */
  rooms: Room[];
  /** The room being edited / furnished; new items land here. */
  activeRoomId: string | null;
  /** Room the description dialog is open for, or null. */
  pendingRoomId: string | null;
  grid: Grid | null;
  items: PlacedItem[];
  selected: string | null;
  edgeEdit: boolean;
  /** Free-built partitions (🧱 tool), independent of the room outline. */
  walls: BuiltWall[];
  wallBuild: boolean;
  /**
   * Armed by the "Create room" button: the next drag on the ground lays out a
   * room as a plain rectangle. A room does not need walls — the walls are
   * decoration on the outline — and this is the direct way to say "make me a
   * room here" instead of tapping each corner and then tapping the first one
   * again to close the loop.
   */
  roomCreate: boolean;
  /** Chain of snapped points for the wall currently being drawn. */
  wallDraft: Vec2[] | null;
  /**
   * The chain point currently being repositioned, with where it was before the
   * move so Esc can put it back exactly. Only ever set for the last clicked
   * point — the ✊ Grab button stops there — because that is the one the user
   * has just placed and most often got slightly wrong.
   */
  wallGrab: { index: number; orig: Vec2 } | null;
  /**
   * Angle (rad) of the wall the current chain is drawn from; null = started on
   * free ground (falls back to the global 45° axes). Every segment of the
   * chain snaps to `wallRef + k*45°`, so new walls stay parallel / square to
   * the wall they were started from.
   */
  wallRef: number | null;
  /**
   * Wall-tool snapping. `align` keeps walls square and parallel; `free` lets a
   * wall sit at any angle, for plans that don't follow the grid.
   */
  wallSnap: WallSnapMode;
  upgradeOpen: boolean;
  welcomeOpen: boolean;
  checkingOut: boolean;
  toast: string | null;

  toastMsg: (m: string) => void;
  setMode: (m: ViewMode) => void;
  setTier: (t: Tier) => void;
  setActiveRoom: (id: string) => void;
  setRoomKind: (k: RoomKind) => void;
  setRoomName: (n: string) => void;
  /** Record what the room is for — name, purpose and a free-text description. */
  describeRoom: (id: string, patch: { name: string; kind: RoomKind; note: string }) => void;
  /** Open / dismiss the "what is this room?" dialog. */
  askRoom: (id: string | null) => void;
  /** Add a room from a closed outline and make it active. */
  addRoom: (poly: Vec2[], openings?: EdgeKind[]) => boolean;
  setRoomCreate: (v: boolean) => void;
  /** Delete a room along with everything inside it. */
  removeRoom: (id: string) => void;
  setEdgeEdit: (v: boolean) => void;
  setWallBuild: (v: boolean) => void;
  setWallSnap: (m: WallSnapMode) => void;
  addWallPoint: (p: Vec2) => void;
  finishWallDraft: () => void;
  grabWallPoint: () => void;
  moveWallGrab: (p: Vec2) => void;
  finishWallGrab: () => void;
  cancelWallGrab: () => void;
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
  tryMoveFine: (uid: string, x: number, y: number) => boolean;
  tryMoveRaw: (uid: string, x: number, y: number) => boolean;
  rotateSelected: () => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  setColorIdx: (uid: string, idx: number) => void;
  cycleEdge: (roomId: string, idx: number) => void;
  cycleWallEdge: (id: string) => void;

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

let roomSeq = 0;
const nextRoomId = () => `r${++roomSeq}-${Date.now().toString(36)}`;

/**
 * How many of one kind are reasonable in a single room.
 *
 * A kitchen has one fridge and one range — the working triangle is one of each.
 * Without this, a preset step that names a kind draws from the whole unlocked
 * pool and a kitchen can come out with four fridges and no hob. Past the cap a
 * step moves on to a different piece of the same category, which is how the
 * free rows end up as cabinet runs rather than duplicates.
 */
const ROOM_QUANTITY: Record<string, number> = {
  'kitchen:fridge': 1,
  'kitchen:range': 1,
  'kitchen:cooktop': 1,
  'kitchen:sinkbase': 1,
  'kitchen:dishwasher': 1,
  'kitchen:hood': 1,
  'kitchen:microwave': 1,
  'kitchen:island': 1,
  'kitchen:peninsula': 1,
  'kitchen:pantry': 1,
  'kitchen:freezer': 1,
  'kitchen:cart': 1,
  'kitchen:recycle': 1,
  'kitchen:wallcab': 3,
  'kitchen:basecab': 4,
  'kitchen:drawerbank': 2,
  'dining:dining': 1,
  'dining:round': 1,
  'dining:trestle': 1,
  'dining:oval': 1,
  'dining:bar': 1,
  'dining:banquet': 1,
  'dining:buffet': 1,
  'dining:china': 1,
  'dining:console': 1,
  'dining:winerack': 1,
  'dining:etagere': 1,
  'dining:serving': 1,
  'dining:barcart': 1,
  'seating:sofa': 1,
  'seating:dining': 8,
  'seating:accent': 4,
  // Caps for the pieces a large room tops up with. Without these the coverage
  // top-up could happily add a fifth coffee table, because an uncapped kind has
  // no limit at all — the list of distinct items, not the count, was the only
  // brake. Repeated pieces are normal in a real room: two nightstands, four
  // dining chairs, a pair of side tables.
  'seating:loveseat': 1,
  'seating:bench': 2,
  'seating:stool': 4,
  'seating:ottoman': 2,
  'seating:pouf': 3,
  'tables:coffee': 2,
  'tables:dining': 2,
  'tables:round': 1,
  'tables:side': 4,
  'tables:console': 2,
  'tables:desk': 1,
  'tables:vanity': 1,
  'tables:accent': 3,
  'tables:nested': 1,
  'storage:bookcase': 3,
  'storage:nightstand': 4,
  'storage:dresser': 2,
  'storage:chest': 3,
  'storage:shelving': 3,
  'storage:cabinet': 3,
  'storage:credenza': 2,
  'storage:sideboard': 1,
  'storage:buffet': 1,
  'storage:armoire': 1,
  'storage:wardrobe': 1,
  'storage:media': 2,
  'beds:platform': 1,
  'beds:upholstered': 1,
  'beds:panel': 1,
  'beds:canopy': 1,
  'beds:sleigh': 1,
  'dining:bench': 2,
  // A nursery has one crib and one changing table; two of either is a mistake,
  // not a variety. Same reasoning for the single-occupancy kit in the other
  // rule-driven categories — a gym gets one treadmill, a laundry one washer.
  'nursery:crib': 1,
  'nursery:bunk': 1,
  'nursery:bassinet': 1,
  'nursery:changing': 1,
  'nursery:mobile': 1,
  'nursery:glider': 1,
  'nursery:pail': 1,
  'nursery:canopy': 1,
  'nursery:monitor': 1,
  'nursery:soundmachine': 1,
  'gym:treadmill': 1,
  'gym:bike': 1,
  'gym:rower': 1,
  'gym:squatrack': 1,
  'gym:weightbench': 1,
  'gym:dumbbellrack': 1,
  'gym:platetree': 1,
  'gym:cablemachine': 1,
  'laundry:washer': 1,
  'laundry:dryer': 1,
  'laundry:stackpair': 1,
  'laundry:utilsink': 1,
  'laundry:foldcounter': 1,
  'laundry:rod': 1,
  'laundry:dryingrack': 1,
  'laundry:ironingboard': 1,
  'laundry:trolley': 1,
  'office:desk': 1,
  'office:standing': 1,
  'office:filing': 1,
  'office:monitor': 1,
  'office:keyboard': 1,
  'office:mouse': 1,
  'office:printer': 1,
  'office:rollingladder': 1,
  'office:taskchair': 2,
  'pantry:pantrycab': 1,
  'pantry:pantrywine': 1,
  'pantry:stepstool': 1,
  'pantry:pantrycart': 2,
  'pantry:pantryshelf': 2,
  'outdoor:rattansofa': 1,
  'outdoor:porchswing': 1,
  'outdoor:bistro': 1,
  'outdoor:rattanchair': 2,
  'closet:closetdrawer': 1,
  'closet:closetisland': 1,
  'closet:rod2': 1,
  'closet:closetshelf': 2,
  'closet:shoerack': 1,
};

/**
 * Categories whose pieces stand on the floor and take up room. The coverage
 * top-up only draws from these: a rug you can walk on and a jar the size of a
 * fist do not make a large room look furnished, and adding them without limit
 * fills a room with clutter while its floor stays bare.
 */
const FURNITURE_TYPES = new Set<string>([
  'seating',
  'tables',
  'storage',
  'beds',
  'kitchen',
  'dining',
  'vanity',
  'bathtub',
  'shower',
  'toilet',
  'nursery',
  'gym',
  'laundry',
  'office',
  'pantry',
  'outdoor',
  'closet',
]);

/**
 * How many of one piece a single room may hold. Keyed by kind, falling back to
 * the category so an unlisted kind in a capped category (a new sofa, say) is
 * still held to the category's limit.
 */
function roomCap(type: string, kind: string): number {
  return ROOM_QUANTITY[`${type}:${kind}`] ?? ROOM_QUANTITY[type] ?? 99;
}

/** The room being edited. Falls back to the first room so callers stay total. */
function activeRoom(s: AppState): Room | null {
  return s.rooms.find((r) => r.id === s.activeRoomId) ?? s.rooms[0] ?? null;
}

/** The room an item belongs to — its own room, else the active one. */
function roomOfItem(s: AppState, it: PlacedItem): Room | null {
  return s.rooms.find((r) => r.id === it.roomId) ?? activeRoom(s);
}

/** Every room outline, for snapping, hit-testing and drawing. */
function roomPolys(s: AppState): Vec2[][] {
  return s.rooms.map((r) => r.poly);
}

/** Rooms containing a point — normally exactly one. */
function roomsAt(s: AppState, p: Vec2): Room[] {
  return s.rooms.filter((r) => pointInPoly(p, r.poly));
}

/** How a piece is being moved: coarse AI grid, 0.1 m keyboard step, or a drag. */
type MoveMode = 'snap' | 'fine' | 'raw';

/**
 * Shared body of the three movement actions.
 *
 * The room an item belongs to decides which walls it has to stay inside, and a
 * manual move re-derives that from where it is being dropped — so furniture can
 * be dragged from the living room into the kitchen, and it then belongs to that
 * room for AI Fill, rotation and wall anchoring. `fine` and `raw` are manual, so
 * they skip the door-approach clearance; `snap` keeps it because it is the
 * layout rule the AI designs to.
 */
function moveItem(
  st: AppState,
  set: (s: Partial<AppState>) => void,
  uid: string,
  x: number,
  y: number,
  mode: MoveMode,
): boolean {
  if (!st.grid) return false;
  const target = st.items.find((i) => i.uid === uid);
  if (!target) return false;
  const item = ITEM_INDEX.get(target.itemId);
  if (!item) return false;

  const own = roomOfItem(st, target);
  if (!own) return false;

  // Wall pieces stay anchored to the room they were placed in; free-standing
  // pieces adopt whichever room contains the drop point.
  const dest = item.mount === 'wall' ? own : roomsAt(st, { x, y })[0] ?? own;
  const edges = edgesOf(dest.poly, dest.openings, st.walls);

  if (item.mount === 'wall') {
    const spot = projectToWall(own.poly, edges, item, x, y);
    if (!spot) return false;
    if (!canPlace(st.grid, own.poly, st.items, ITEM_INDEX, item, spot.x, spot.y, spot.rot, uid))
      return false;
    set({
      items: st.items.map((i) =>
        i.uid === uid ? { ...i, x: spot.x, y: spot.y, rot: spot.rot } : i,
      ),
    });
    return true;
  }

  const step = mode === 'raw' ? 0 : mode === 'fine' ? 0.1 : 0.25;
  const sx = step ? Math.round(x / step) * step : x;
  const sy = step ? Math.round(y / step) * step : y;

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

  const ok =
    mode === 'raw'
      ? canPlaceRaw(st.grid, dest.poly, st.items, ITEM_INDEX, item, sx, sy, target.rot, uid)
      : mode === 'fine'
        ? canPlaceManual(st.grid, dest.poly, st.items, ITEM_INDEX, item, sx, sy, target.rot, uid)
        : canPlace(st.grid, dest.poly, st.items, ITEM_INDEX, item, sx, sy, target.rot, uid);
  if (!ok) return false;

  const moved = st.items.map((i) => (i.uid === uid ? { ...i, x: sx, y: sy, roomId: dest.id } : i));
  // A door moves freely, so whether it is in an opening is decided by where it
  // lands: near a wall it opens that wall, away from one it closes the wall it
  // left. Dragging a door across a room must not leave a hole behind it.
  const isDoor = item.type === 'doors';
  const rooms = isDoor
    ? releaseDoorEdge(
        withDoorOpening(st.rooms, dest.id, sx, sy),
        dest.id,
        target.x,
        target.y,
        moved,
      )
    : st.rooms;
  set({
    items: moved,
    ...(isDoor && rooms !== st.rooms ? { rooms, grid: makeGrid(rooms, st.walls) } : {}),
  });
  return true;
}


export const useStore = create<AppState>((set, get) => ({
  tier: 'free',
  mode: 'draw',
  draft: null,
  rooms: [],
  activeRoomId: null,
  pendingRoomId: null,
  grid: null,
  items: [],
  selected: null,
  edgeEdit: false,
  walls: [],
  wallBuild: false,
  roomCreate: false,
  wallDraft: null,
  wallGrab: null,
  wallRef: null,
  wallSnap: 'align',
  upgradeOpen: false,
  welcomeOpen: true,
  checkingOut: false,
  toast: null,

  toastMsg: (m) => toast(get, set, m),
  setMode: (m) => {
    const st = get();
    if ((m === 'furnish' || m === '3d') && (!st.rooms.length || !st.grid)) {
      toast(get, set, 'Draw a room first — click to place corners, then click the first point.');
      set({ mode: 'draw' });
      return;
    }
    // Commit any in-progress wall chain before leaving the 2D view.
    if (m === '3d' && st.wallDraft) get().finishWallDraft();
    set({
      mode: m,
      selected: m === '3d' ? null : st.selected,
      ...(m === '3d' ? { wallBuild: false, roomCreate: false, wallDraft: null, wallGrab: null, wallRef: null } : {}),
    });
  },
  setTier: (t) => set({ tier: t }),

  // -------------------------------------------------------------- rooms
  setActiveRoom: (id) => set({ activeRoomId: id, selected: null }),

  setRoomKind: (k) => {
    const st = get();
    if (!st.activeRoomId) return;
    set({ rooms: st.rooms.map((r) => (r.id === st.activeRoomId ? { ...r, kind: k } : r)) });
  },

  setRoomName: (n) => {
    const st = get();
    if (!st.activeRoomId) return;
    set({ rooms: st.rooms.map((r) => (r.id === st.activeRoomId ? { ...r, name: n } : r)) });
  },

  /**
   * Record what a room is for: its name, its purpose and a free-text note.
   * Dismisses the prompt. The note is kept on the room so AI Fill can read it
   * later — a description is allowed to be more specific than the category.
   */
  describeRoom: (id, patch) => {
    const st = get();
    set({
      rooms: st.rooms.map((r) =>
        r.id === id ? { ...r, name: patch.name, kind: patch.kind, note: patch.note } : r,
      ),
      pendingRoomId: null,
      activeRoomId: id,
    });
    toast(get, set, `${patch.name.trim() || ROOM_LABEL[patch.kind]} saved — AI Fill will use it.`);
  },

  askRoom: (id) => set({ pendingRoomId: id }),

  /**
   * Add a room from a closed outline and make it active. Rejects outlines that
   * are too small or that already sit inside an existing room, so drawing a
   * loop can never silently swallow the room you are working on.
   */
  addRoom: (poly, openings) => {
    const st = get();
    // Disarm either way: a rejected outline should not leave the tool armed to
    // fail again on the next drag.
    if (st.roomCreate) set({ roomCreate: false });
    const clean = cleanPolygon(poly);
    if (!clean) {
      toast(get, set, 'That loop is too small to be a room — aim for at least 4 m².');
      return false;
    }
    // A room must not overlap an existing one; two outlines sharing floor would
    // make furniture placement ambiguous.
    for (const r of st.rooms) {
      if (polysOverlap(clean, r.poly)) {
        toast(get, set, 'That loop overlaps an existing room — draw it in clear floor.');
        return false;
      }
    }
    const room: Room = {
      id: nextRoomId(),
      poly: clean,
      openings: openings ?? suggestOpenings(clean),
      kind: 'living',
      name: '',
      note: '',
    };
    const rooms = [...st.rooms, room];
    set({
      rooms,
      activeRoomId: room.id,
      // Ask what the space is for before anything is placed in it.
      pendingRoomId: room.id,
      grid: makeGrid(rooms, st.walls),
      mode: 'furnish',
    });
    return true;
  },

  setRoomCreate: (v) => {
    // Arming this means drawing a floor, not walls, and the two tools would
    // otherwise fight over the same gesture.
    set(v ? { roomCreate: true, wallBuild: false, draft: null, selected: null } : { roomCreate: false });
  },

  removeRoom: (id) => {
    const st = get();
    const rooms = st.rooms.filter((r) => r.id !== id);
    if (rooms.length === st.rooms.length) return;
    const nextActive = st.activeRoomId === id ? rooms[0]?.id ?? null : st.activeRoomId;
    set({
      rooms,
      activeRoomId: nextActive,
      pendingRoomId: st.pendingRoomId === id ? null : st.pendingRoomId,
      // Items in a deleted room have nowhere to live.
      items: st.items.filter((i) => i.roomId !== id),
      grid: rooms.length ? makeGrid(rooms, st.walls) : null,
      selected: null,
      mode: rooms.length ? st.mode : 'draw',
    });
    toast(get, set, 'Room deleted.');
  },

  setEdgeEdit: (v) => {
    if (v && get().wallDraft) get().finishWallDraft();
    set(v ? { edgeEdit: true, wallBuild: false, roomCreate: false, wallDraft: null, wallGrab: null, wallRef: null } : { edgeEdit: false });
  },

  // -------------------------------------------------------------- 🧱 walls
  setWallSnap: (m) => set({ wallSnap: m }),
  setWallBuild: (v) => {
    if (!v && get().wallDraft) get().finishWallDraft();
    set(
      v
        ? { wallBuild: true, roomCreate: false, wallDraft: null, wallGrab: null, wallRef: null, edgeEdit: false, selected: null }
        : { wallBuild: false, roomCreate: false, wallDraft: null, wallGrab: null, wallRef: null },
    );
  },
  addWallPoint: (p) => {
    const st = get();
    if (!st.wallBuild) return;
    const pts = st.wallDraft ?? [];

    // Start a new chain — remember which wall it is drawn from, so every
    // segment of the chain stays aligned to that wall.
    if (!pts.length) {
      const { pt, ref } = startWallPoint(p, roomPolys(st), st.walls, st.wallSnap);
      set({ wallDraft: [pt], wallGrab: null, wallRef: ref });
      toast(
        get,
        set,
        st.wallSnap === 'free'
          ? 'Free-drawing walls — corners and exact joins still snap. Esc finishes.'
          : ref !== null
            ? 'Wall started — every segment aligns to the wall you began from. Esc finishes.'
            : 'Wall started — click to extend, click the first point to close, Esc to finish.',
      );
      return;
    }

    const first = pts[0];

    // Clicking the first point closes the loop. Append it to the chain so the
    // closing segment becomes a real wall, then commit — finishWallDraft
    // recognises the repeated start point and turns the loop into a room.
    if (pts.length >= 3 && dist2(p, first) < CLOSE_RADIUS * CLOSE_RADIUS) {
      set({ wallDraft: [...pts, first], wallGrab: null });
      get().finishWallDraft();
      return;
    }

    const q = snapWallPoint(p, roomPolys(st), st.walls, pts, st.wallRef, st.wallSnap);
    const last = pts[pts.length - 1];
    if (dist2(q, last) < 0.2 * 0.2) return; // ignore tiny segments
    // Clicking back on the start point ends the chain (needs >= 2 segments).
    if (dist2(q, first) < 0.05 * 0.05 && pts.length >= 2) {
      get().finishWallDraft();
      return;
    }
    // A new point supersedes the grab: there is nothing left to re-position
    // once the user has carried on past it.
    set({ wallDraft: [...pts, q], wallGrab: null });
  },
  /**
   * Pick up the last clicked wall point so it can be re-positioned.
   *
   * Only the newest point is grabbable — it is the one the user has just placed
   * and most often wants to nudge, and keeping the target fixed means the
   * button needs no second tap to say which point it means. Grabbing with a
   * single-point chain is pointless (there is no segment to correct), so it is
   * refused.
   */
  grabWallPoint: () => {
    const st = get();
    if (!st.wallBuild || !st.wallDraft || st.wallDraft.length < 2) return;
    const index = st.wallDraft.length - 1;
    set({ wallGrab: { index, orig: { ...st.wallDraft[index] } } });
    toast(get, set, 'Grabbed the last wall point — move it, then ✓ Done, Enter or right-click.');
  },
  /**
   * Re-snap and store the grabbed point.
   *
   * The chain handed to the snapper stops just short of the grabbed point, so
   * its last element — the anchor — is the point before it. That makes the
   * grabbed point snap exactly as it did when first placed: same 45° lattice
   * against the same previous segment, same corner and T-junction rules. The
   * only difference from a fresh click is that the user's own point is absent
   * from the vertex list, so it cannot snap back onto itself.
   */
  moveWallGrab: (p) => {
    const st = get();
    const grab = st.wallGrab;
    if (!grab || !st.wallDraft) return;
    const pts = st.wallDraft;
    if (grab.index >= pts.length) return;
    const q = snapWallPoint(p, roomPolys(st), st.walls, pts.slice(0, grab.index), st.wallRef, st.wallSnap);
    const next = [...pts];
    next[grab.index] = q;
    set({ wallDraft: next });
  },
  /** Commit the move and let drawing carry on from the new position. */
  finishWallGrab: () => {
    set({ wallGrab: null });
    toast(get, set, 'Wall point moved — click to keep drawing.');
  },
  /** Abandon the move and put the point back exactly where it was. */
  cancelWallGrab: () => {
    const st = get();
    const grab = st.wallGrab;
    if (!grab || !st.wallDraft || grab.index >= st.wallDraft.length) {
      set({ wallGrab: null });
      return;
    }
    const next = [...st.wallDraft];
    next[grab.index] = grab.orig;
    set({ wallDraft: next, wallGrab: null });
  },
  /**
   * Commit the wall chain. When the chain came back to its own start the loop
   * encloses a space, so it becomes a room on the spot — that is how the 🧱
   * tool doubles as a room builder, and it means nobody has to redraw the same
   * outline a second time with the ✏️ draw tool.
   */
  finishWallDraft: () => {
    const st = get();
    if (!st.wallDraft) return;
    const pts = st.wallDraft;
    if (pts.length < 2) {
      set({ wallDraft: null, wallGrab: null, wallRef: null });
      return;
    }
    // A chain whose last point sits back on its first point has closed a loop.
    // Drop that repeated point: the room outline must not carry a zero-length
    // edge.
    const closed = pts.length >= 4 && dist2(pts[pts.length - 1], pts[0]) < CLOSE_RADIUS * CLOSE_RADIUS;
    const path = closed ? pts.slice(0, -1) : pts;

    const walls = [...st.walls];
    const newIds = new Set<string>();
    const addWall = (a: Vec2, b: Vec2) => {
      const id = nextWallId();
      newIds.add(id);
      walls.push({ id, a, b, kind: 'wall' });
    };
    for (let i = 1; i < path.length; i++) addWall(path[i - 1], path[i]);
    // An explicitly closed chain gets its closing wall too, so that case is
    // just another enclosed loop rather than a special case of its own.
    if (closed) addWall(path[path.length - 1], path[0]);

    // Whatever these walls have now boxed in becomes a room. This is what
    // catches the everyday case: three sides drawn fresh while the fourth
    // belongs to the room next door, so the loop closes without the user ever
    // clicking back to their own start point. Existing rooms contribute their
    // outlines to the search for the same reason — they own real edges that
    // close loops. Only faces involving a wall from this chain count, so a
    // leftover loop elsewhere on the plan cannot ambush the user.
    const roomEdges = get().rooms.flatMap((r) =>
      r.poly.map((p, i) => ({ id: `room:${r.id}:${i}`, a: p, b: r.poly[(i + 1) % r.poly.length] })),
    );
    const faces = findEnclosedFaces(walls, roomEdges).filter((f) =>
      f.wallIds.some((id) => newIds.has(id)),
    );

    // A loop's walls are absorbed into the room outline — but only once the loop
    // is known to be a valid room. If it is too small, or it lands on a room
    // that is already there, the user drew those walls either way and they have
    // to survive as free-built partitions. Deciding this *before* the wall list
    // is rewritten is the whole point: doing it afterwards deleted the walls and
    // then announced that they had been kept.
    const wallIds = new Set(walls.map((w) => w.id));
    const consumed = new Set<string>();
    const made: Room[] = [];
    let tooSmall = 0;
    let clashCount = 0;
    for (const f of faces) {
      const clean = cleanPolygon(f.poly);
      if (!clean) {
        tooSmall++;
        continue;
      }
      if ([...get().rooms, ...made].some((r) => polysOverlap(clean, r.poly))) {
        clashCount++;
        continue;
      }
      // Room-outline edges helped find this face but are not free walls, so
      // only real wall ids may be removed.
      for (const id of f.wallIds) if (wallIds.has(id)) consumed.add(id);
      made.push({
        id: nextRoomId(),
        poly: clean,
        openings: suggestOpenings(clean),
        kind: 'living',
        name: '',
        note: '',
      });
    }

    const remaining = walls.filter((w) => !consumed.has(w.id));
    const rooms = [...get().rooms, ...made];

    set({
      wallDraft: null,
      wallGrab: null,
      wallRef: null,
      walls: remaining,
      ...(made.length
        ? {
            rooms,
            activeRoomId: made[0].id,
            // Ask what the room is for straight away: that is what picks the
            // furniture, so a room with no type is a room waiting to be wrong.
            pendingRoomId: made[0].id,
            mode: 'furnish' as const,
            selected: null,
          }
        : {}),
      grid: rooms.length ? makeGrid(rooms, remaining) : st.grid,
    });

    if (made.length === 1) {
      toast(
        get,
        set,
        `Room created — ${polyArea(made[0].poly).toFixed(1)} m². Name it and pick its type, then AI Fill.`,
      );
      return;
    }
    if (made.length > 1) {
      toast(
        get,
        set,
        `${made.length} rooms created — name them and pick their types, then AI Fill.`,
      );
      return;
    }
    if (tooSmall) {
      toast(get, set, 'Wall loop closed — too small to be a room, so it stayed walls.');
      return;
    }
    if (clashCount) {
      toast(get, set, 'Wall loop closed — it overlaps an existing room, so it stayed walls.');
      return;
    }
    toast(get, set, 'Wall finished.');
  },
  removeWall: (id) => {
    const st = get();
    const walls = st.walls.filter((w) => w.id !== id);
    set({ walls, grid: st.rooms.length ? makeGrid(st.rooms, walls) : st.grid });
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
    if (!get().addRoom(draft)) return;
    set({ draft: null });
  },
  clearRoom: () =>
    set({
      rooms: [],
      activeRoomId: null,
      draft: null,
      grid: null,
      items: [],
      selected: null,
      mode: 'draw',
      edgeEdit: false,
      walls: [],
      wallDraft: null,
      wallGrab: null,
      wallRef: null,
      wallBuild: false,
    }),

  addItem: (itemId) => {
    const st = get();
    const item = ITEM_INDEX.get(itemId);
    if (!item) return;
    const room = activeRoom(st);
    if (!st.grid || !room) {
      toast(get, set, 'Draw a room first.');
      return;
    }
    if (!tierUnlocked(item.tier, st.tier)) {
      set({ upgradeOpen: true });
      return;
    }
    const spot = findBestSpot(
      st.grid,
      room.poly,
      st.items,
      ITEM_INDEX,
      item,
      edgesOf(room.poly, room.openings, st.walls),
    );
    if (!spot) {
      toast(get, set, `No room for the ${item.name} — remove something first.`);
      return;
    }
    const placed: PlacedItem = {
      uid: nextUid(),
      itemId,
      roomId: room.id,
      x: spot.x,
      y: spot.y,
      rot: spot.rot,
      colorIdx: 0,
    };
    const rooms = item.type === 'doors' ? withDoorOpening(st.rooms, room.id, spot.x, spot.y) : st.rooms;
    set({
      items: [...st.items, placed],
      selected: placed.uid,
      ...(item.type === 'doors' ? { rooms, grid: makeGrid(rooms, st.walls) } : {}),
    });
    toast(get, set, `${item.name} placed.`);
  },

  tryMove: (uid, x, y) => moveItem(get(), set, uid, x, y, 'snap'),

  /** Fine-grained move for keyboard nudges (0.1 m snap instead of 0.25 m). */
  tryMoveFine: (uid, x, y) => moveItem(get(), set, uid, x, y, 'fine'),

  /** Raw move for drag operations - no snap, no door clearance, just collision + walls. */
  tryMoveRaw: (uid, x, y) => moveItem(get(), set, uid, x, y, 'raw'),


  rotateSelected: () => {
    const st = get();
    if (!st.selected || !st.grid) return;
    const target = st.items.find((i) => i.uid === st.selected);
    if (!target) return;
    const room = roomOfItem(st, target);
    if (!room) return;
    const item = ITEM_INDEX.get(target.itemId);
    if (!item) return;
    const edges = edgesOf(room.poly, room.openings, st.walls);

    if (item.mount === 'wall') {
      // Wall pieces hop to the next wall that fits.
      const spot = nextWallSpot(room.poly, st.items, ITEM_INDEX, item, edges, target.x, target.y);
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
    if (!canPlace(st.grid, room.poly, st.items, ITEM_INDEX, item, target.x, target.y, rot, target.uid)) {
      toast(get, set, "Can't rotate there — not enough space.");
      return;
    }
    set({ items: st.items.map((i) => (i.uid === target.uid ? { ...i, rot } : i)) });
  },

  duplicateSelected: () => {
    const st = get();
    if (!st.selected || !st.grid) return;
    const target = st.items.find((i) => i.uid === st.selected);
    if (!target) return;
    const room = roomOfItem(st, target);
    if (!room) return;
    const item = ITEM_INDEX.get(target.itemId);
    if (!item) return;
    const spot = findBestSpot(
      st.grid,
      room.poly,
      st.items,
      ITEM_INDEX,
      item,
      edgesOf(room.poly, room.openings, st.walls),
      { rotations: [target.rot, ((target.rot + 90) % 360) as 0 | 90] },
    );
    if (!spot) {
      toast(get, set, 'No space for another one.');
      return;
    }
    const copy: PlacedItem = { ...target, uid: nextUid(), x: spot.x, y: spot.y, rot: spot.rot };
    const rooms = item.type === 'doors' ? withDoorOpening(st.rooms, copy.roomId, spot.x, spot.y) : st.rooms;
    set({
      items: [...st.items, copy],
      selected: copy.uid,
      ...(item.type === 'doors' ? { rooms, grid: makeGrid(rooms, st.walls) } : {}),
    });
    toast(get, set, `${item.name} duplicated.`);
  },

  removeSelected: () => {
    const st = get();
    if (!st.selected) return;
    const gone = st.items.find((i) => i.uid === st.selected);
    const items = st.items.filter((i) => i.uid !== st.selected);
    // Take the wall back if the door that opened it is the one being removed.
    const rooms =
      gone && ITEM_INDEX.get(gone.itemId)?.type === 'doors' && gone.roomId
        ? releaseDoorEdge(st.rooms, gone.roomId, gone.x, gone.y, items)
        : st.rooms;
    set({
      items,
      selected: null,
      ...(rooms !== st.rooms ? { rooms, grid: makeGrid(rooms, st.walls) } : {}),
    });
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

  /** Cycle one edge of the active room between wall / window / door. */
  /**
   * Cycle one edge of a room between wall / window / door. Takes the room id
   * explicitly (not just the active room) so clicking an edge in a room you
   * aren't currently editing still changes the right wall.
   */
  cycleEdge: (roomId, idx) => {
    const st = get();
    const room = st.rooms.find((r) => r.id === roomId) ?? activeRoom(st);
    if (!room) return;
    const order: EdgeKind[] = ['wall', 'window', 'door'];
    const cur = room.openings[idx] ?? 'wall';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    const openings = room.openings.map((o, i) => (i === idx ? next : o));
    const rooms = st.rooms.map((r) => (r.id === room.id ? { ...r, openings } : r));
    // Rebuild the grid so a new door edge blocks its swing + entry path.
    set({ rooms, grid: makeGrid(rooms, st.walls) });
    toast(get, set, `Edge → ${next}`);
  },

  /** Cycle the kind of a built wall between wall / window / door. */
  cycleWallEdge: (id) => {
    const st = get();
    const w = st.walls.find((x) => x.id === id);
    if (!w) return;
    const order: EdgeKind[] = ['wall', 'window', 'door'];
    const next = order[(order.indexOf(w.kind) + 1) % order.length];
    const walls = st.walls.map((x) => (x.id === id ? { ...x, kind: next } : x));
    set({ walls, grid: st.rooms.length ? makeGrid(st.rooms, walls) : st.grid });
    toast(get, set, `Wall → ${next}`);
  },

  aiFill: () => {
    const st = get();
    if (!st.grid || !st.rooms.length) {
      toast(get, set, 'Draw a room first.');
      return;
    }

    // Fill every room with the objects its own type calls for, so a plan with a
    // living room and a kitchen gets a sofa and a run of worktops rather than
    // the same layout twice. The grid spans all rooms, so rooms can't collide.
    let placed = 0;
    let skipped = 0;
    let overBudget = 0;
    const items: PlacedItem[] = [];

    for (const room of st.rooms) {
      // The description is read alongside the room's purpose, so "small galley
      // for two, opens to the lounge" narrows the objects the way the purpose
      // alone cannot.
      const roomArea = Math.abs(polyArea(room.poly));
      const steps = withCeilingLight([
        ...(PRESETS[room.kind] ?? PRESETS.living),
        ...stepsFromNote(room.note, room.kind),
      ]);
      // Rule 7 — one ceiling light per 9 square metres. These are the extra
      // downlights; the feature fitting over the table or centre of the room is
      // the one the presets already carry.
      const lights = ceilingLightsFor(roomArea);
      // Recessed, so they read as a grid of downlights rather than competing
      // with the pendant the preset puts in. Repeats are allowed for ceiling
      // lights (see the duplicate rule below): the library holds two recessed
      // fittings and rule 7 asks for up to fourteen.
      for (let i = 0; i < lights; i++) steps.push({ type: 'ceilight', kind: 'recessed' });
      const dupFree = roomArea <= DUPLICATE_FREE_AREA_MAX;
      const edges = edgesOf(room.poly, room.openings, st.walls);
      const inRoom: PlacedItem[] = [];

      // Quantity budget for this room. Floor furniture is what a room can feel
      // crowded by, so the two limits are counted against it only: wall, ceiling
      // and tabletop pieces add to the sense of a finished room without taking
      // any floor away, and stopping those short would just look unfinished.
      const budget = coverageBudget(roomArea) * roomArea;
      const pieceCap = floorPieceLimit(room.kind, roomArea);
      let floorArea = 0;
      let floorPieces = 0;

      /**
       * Pick one item for a step and put it down. Returns false when nothing
       * could be placed, which is what both the main pass and the coverage
       * top-up below use to know when to stop.
       */
      const attempt = (
        step: PresetStep,
        allowRepeat = false,
        preferLarge = false,
        floorOnly = false,
        capScale = 1,
        dupFreeRoom = false,
      ): boolean => {
        // Unlocked candidates, preferring the requested kind.
        let pool = LIBRARY.filter(
          (i) => i.type === step.type && tierUnlocked(i.tier, st.tier),
        );
        if (!pool.length) return false;
        if (step.kind) {
          const exact = pool.filter((i) => i.kind === step.kind);
          // Only narrow to the exact kind when it's actually available. On a
          // lower tier it may be locked, and then the step falls back to the
          // rest of the category — so the quota below has to be applied to
          // whatever gets picked, not to the kind we asked for.
          if (exact.length) pool = exact;
        }
        // R22 — the coffee table should be 1/2 to 2/3 the length of the sofa.
        if (step.kind === 'coffee') {
          const sofa = inRoom.find((it) => ITEM_INDEX.get(it.itemId)?.kind === 'sofa');
          if (sofa) {
            const sf = ITEM_INDEX.get(sofa.itemId)!;
            const fit = pool.filter(
              (i) => i.w >= CLEARANCE.coffeeLenMin * sf.w && i.w <= CLEARANCE.coffeeLenMax * sf.w,
            );
            if (fit.length) pool = fit;
          }
        }
        // Per-room quota, applied to the kind actually being placed: a kitchen
        // gets one fridge and one range, not four fridges. Also skips anything
        // already in the room, so a repeated step can't stack identical pieces.
        const heldOf = (kind: string) =>
          inRoom.filter((it) => ITEM_INDEX.get(it.itemId)?.kind === kind).length;
        const eligible = pool.filter((p) => {
          // capScale lets a big room repeat its anchors. "One sofa" is right for
          // a 22 m² living room and wrong for 120 m², where a second seating
          // group is the difference between furnished and empty — and it is the
          // per-kind cap, not the piece budget, that binds first there.
          // The ceiling-light count is fixed by rule 7, not by taste: one per 9 m².
          // The per-kind cap exists to stop a room collecting nine of the same
          // chair, and applying it to downlights capped a large room well below
          // the number rule 7 asks for.
          if (step.type !== 'ceilight') {
            const cap = Math.max(1, Math.round(roomCap(p.type, p.kind) * capScale));
            if (heldOf(p.kind) >= cap) return false;
          }
          // The top-up is chasing floor coverage, so a wall or ceiling piece
          // cannot help it. Without this it filled a kitchen with wall cabinets
          // — they are in a furniture category but never touch the floor, so
          // neither the coverage target nor the piece cap ever moved.
          if (floorOnly && p.mount !== 'floor') return false;
          // The main pass never repeats a piece, so a step listed twice can't
          // stack two identical sofas. The coverage top-up does allow it — a
          // second nightstand is correct, and refusing repeats there is what
          // left a large room unable to fill up at all.
          if (allowRepeat) return true;
          // Rule 7's downlights are the one thing a room is meant to repeat, so they are
          // exempt from the no-duplicates rule in every room, not just the
          // duplicate-free ones. The library holds two recessed fittings and
          // rule 7 can ask for fourteen.
          if (step.type === 'ceilight') return true;
          if (dupFreeRoom) {
            // Rule 5 is about furniture. Two cushions on a sofa or a pair of
            // sconces is normal; two identical side tables is not.
            if (!FURNITURE_TYPES.has(p.type)) return true;
            // The exceptions the rule allows.
            if (repeatable(p)) return true;
            // Duplicates are judged by kind, not by catalogue item: two different
            // "Halo Side Table" rows are still two side tables.
            const key = `${p.type}:${p.kind}`;
            const already = inRoom.some((it) => {
              const of = ITEM_INDEX.get(it.itemId);
              return of ? `${of.type}:${of.kind}` === key : false;
            });
            if (already) return false;
          }
          return !inRoom.some((it) => it.itemId === p.id);
        });
        if (!eligible.length) return false;
        // Topping up is about reaching a share of the floor, so take the big
        // pieces first: picking at random filled a large dining room with extra
        // chairs, which are 0.2 m² each, and barely moved the number. The top
        // three are still sampled at random so two fills of the same room do
        // not come out identical.
        const pick = preferLarge
          ? [...eligible].sort((a, b) => b.w * b.d - a.w * a.d)[
              Math.floor(Math.random() * Math.min(3, eligible.length))
            ]
          : eligible[Math.floor(Math.random() * eligible.length)];

        // Respect the room's quantity ceiling before trying to place. A rug or
        // a flat runner is walkable and never makes a room feel tight, so it is
        // exempt — the guideline is about furniture standing on the floor.
        const onFloor = pick.mount === 'floor' && !isFlat(pick);
        if (onFloor && (floorPieces >= pieceCap || floorArea + pick.w * pick.d > budget)) {
          overBudget++;
          return false;
        }
        // Place against everything already in the room *and* other rooms.
        const spot = findBestSpot(st.grid, room.poly, items, ITEM_INDEX, pick, edges);
        if (!spot) {
          skipped++;
          return false;
        }
        const it: PlacedItem = {
          uid: nextUid(),
          itemId: pick.id,
          roomId: room.id,
          x: spot.x,
          y: spot.y,
          rot: spot.rot,
          colorIdx: 0,
        };
        inRoom.push(it);
        items.push(it);
        placed++;
        if (onFloor) {
          floorPieces++;
          floorArea += pick.w * pick.d;
        }
        return true;
      };

      for (const step of steps) {
        // Accessory groups are rounded to an odd number; everything else takes
        // the step's count as written.
        const want = step.count ?? 1;
        const count = step.group ? oddCount(want) : want;
        for (let c = 0; c < count; c++) attempt(step, false, false, false, 1, dupFree);
      }

      // Coverage floor. The list above is a fixed count, so a big room came out
      // nearly bare — a 120 m² living room held 21 items across 5% of its floor,
      // which reads as an empty room rather than a furnished one. Keep going
      // through the same list until the furniture takes up its share of the
      // floor, or until nothing more fits. The share sits well under the
      // ceiling above, so the two rules never argue.
      // Aim a little past the floor. A candidate that will not quite fit is dropped
      // rather than nudged, so a room can stop just short of the target it was
      // aiming at; the small overshoot is what keeps "reaches the floor" true
      // rather than usually-true. The ceiling above still caps the result.
      const want = roomArea * COVERAGE_FLOOR * 1.1;
      // How much more of each piece this room's size justifies. Same curve as
      // the piece budget, so the two grow together.
      const capScale = dupFree ? 1 : Math.sqrt(roomArea / 22.5);
      // Once a room's own list is exhausted, top up from the major furniture
      // categories. A 120 m² office runs out of desk-and-chair long before it
      // runs out of floor, and a second bookcase is a better answer than a
      // fifth small desk accessory.
      const topUp: PresetStep[] = [
        ...steps,
        { type: 'seating' },
        { type: 'tables' },
        { type: 'storage' },
      ];
      let rounds = 0;
      while (floorArea < want && floorPieces < pieceCap && rounds < 12) {
        rounds++;
        let progressed = false;
        for (const step of topUp) {
          if (floorArea >= want || floorPieces >= pieceCap) break;
          // Only furniture counts towards floor coverage, so only furniture is
          // added here. Letting the top-up reach decor too filled a room with
          // 140 baskets — flat textiles are exempt from the ceiling, and small
          // pieces have no cap, so they piled up without ever tripping a limit.
          if (!FURNITURE_TYPES.has(step.type)) continue;
          if (attempt(step, true, true, true, capScale, dupFree)) progressed = true;
        }
        // Nothing in the whole list fits any more — stop rather than spin.
        if (!progressed) break;
      }
      // Post-pass: apply the relational design rules (conversation circle,
      // coffee-table gap, nightstands, art placement, rug anchoring, …). It
      // works on this room's items only — a bedroom's bed shouldn't be related
      // to the sofa two rooms away — then the results are copied back by uid.
      refineLayout(st.grid, room.poly, inRoom, ITEM_INDEX, edges, room.kind);
      for (const refined of inRoom) {
        const at = items.findIndex((i) => i.uid === refined.uid);
        if (at >= 0) items[at] = refined;
      }
    }
    set({ items, selected: null });
    const rooms = st.rooms.length;
    const notes: string[] = [];
    if (skipped) notes.push(`${skipped} didn't fit — try a bigger room`);
    if (overBudget) notes.push(`${overBudget} left out to keep the floor clear`);
    toast(
      get,
      set,
      notes.length
        ? `AI placed ${placed} items across ${rooms} room${rooms > 1 ? 's' : ''} (${notes.join('; ')}).`
        : `AI placed ${placed} items across ${rooms} room${rooms > 1 ? 's' : ''} using the ${RULES.length}-rule design guide.`,
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
    if (!st.rooms.length) {
      toast(get, set, 'Nothing to save yet.');
      return;
    }
    const data: ProjectV2 = {
      rooms: st.rooms,
      items: st.items,
      walls: st.walls,
      activeRoomId: st.activeRoomId,
    };
    localStorage.setItem('roomcraft:project', JSON.stringify(data));
    toast(get, set, `Project saved — ${st.rooms.length} room${st.rooms.length > 1 ? 's' : ''}.`);
  },

  loadProject: () => {
    const raw = localStorage.getItem('roomcraft:project');
    if (!raw) {
      toast(get, set, 'No saved project found.');
      return;
    }
    try {
      const data = JSON.parse(raw) as Project;
      const v2 = data as ProjectV2;
      const v1 = data as ProjectV1;
      // v1 saved a single room; lift it into the room list so old projects open.
      let rooms: Room[];
      if (Array.isArray(v2.rooms) && v2.rooms.length) {
        // Rooms saved before descriptions existed have no `note` field.
        rooms = v2.rooms.map((r) => ({ ...r, note: r.note ?? '' }));
      } else if (Array.isArray(v1.room) && v1.room.length >= 3) {
        rooms = [
          {
            id: nextRoomId(),
            poly: v1.room,
            openings: v1.openings ?? [],
            kind: v1.roomKind ?? 'living',
            name: '',
            note: '',
          },
        ];
      } else {
        throw new Error('no room outline');
      }
      const walls = v2.walls ?? v1.walls ?? [];
      // Older saves predate roomId on items; attach them to the only room.
      const items = (v2.items ?? v1.items ?? []).map((i) => ({
        ...i,
        roomId: i.roomId ?? rooms[0].id,
      }));
      const activeRoomId =
        ('activeRoomId' in data ? data.activeRoomId : null) ?? rooms[0]?.id ?? null;
      set({
        rooms,
        activeRoomId,
        items,
        walls,
        grid: makeGrid(rooms, walls),
        mode: 'furnish',
        selected: null,
        draft: null,
        wallDraft: null,
        wallGrab: null,
        wallRef: null,
        wallBuild: false,
      });
      toast(get, set, `Project loaded — ${rooms.length} room${rooms.length > 1 ? 's' : ''}.`);
    } catch {
      toast(get, set, 'Saved project is corrupted.');
    }
  },

  loadDemo: () => {
    const walls = [...DEMO_WALLS];
    const rooms = DEMO_ROOMS.map((r) => ({ ...r, poly: r.poly.map((p) => ({ ...p })) }));
    const grid = makeGrid(rooms, walls);
    set({
      rooms,
      activeRoomId: rooms[0].id,
      items: [],
      walls,
      grid,
      draft: null,
      selected: null,
      welcomeOpen: false,
      mode: 'furnish',
      edgeEdit: false,
      wallDraft: null,
      wallGrab: null,
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
export const selectActiveRoom = activeRoom;
export const selectRooms = (s: AppState) => s.rooms;
export const selectRoomPolys = roomPolys;
/** Floor area of the whole plan, in m². */
export const selectArea = (s: AppState) => s.rooms.reduce((n, r) => n + polyArea(r.poly), 0);
/** Bounding-box centre of the plan, used to frame the camera. */
export const selectCentroid = (s: AppState) => {
  if (!s.rooms.length) return { x: 0, y: 0 };
  const r = activeRoom(s);
  return r ? polyCentroid(r.poly) : { x: 0, y: 0 };
};
/** Total area of every room on the plan, in m². */
export const selectPlanArea = (s: AppState) =>
  s.rooms.reduce((n, r) => n + polyArea(r.poly), 0);
export { CELL, rotatedSize };
