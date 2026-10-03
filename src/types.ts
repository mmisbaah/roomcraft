// Shared domain types for RoomCraft

export type Tier = 'free' | 'pro' | 'max';

/**
 * Where an item lives:
 *  - floor    : normal grid placement (sofas, beds, plants…)
 *  - wall     : anchored to a wall edge (art, sconces, curtains…)
 *  - ceiling  : hangs from the ceiling (chandeliers, hanging plants…)
 *  - surface  : sits on a table/top (table lamps, vases…); falls back to floor
 */
export type Mount = 'floor' | 'wall' | 'ceiling' | 'surface';

/** Library category ids (one section each in the sidebar, 20 items each). */
export type FurnType =
  | 'seating'
  | 'tables'
  | 'storage'
  | 'beds'
  | 'ceilight'
  | 'walllight'
  | 'floorlamp'
  | 'archlight'
  | 'floorplants'
  | 'tableplants'
  | 'succulents'
  | 'hangingplants'
  | 'trees'
  | 'textiles'
  | 'walldecor'
  | 'tabletop'
  | 'functional'
  | 'vanity'
  | 'bathtub'
  | 'shower'
  | 'toilet'
  | 'towelrack'
  | 'vamirror';

export type EdgeKind = 'wall' | 'window' | 'door';

export type ViewMode = 'draw' | 'furnish' | '3d';

/**
 * What a room is used for. The kind drives which objects AI Fill chooses, so
 * the list is deliberately made of things you can actually furnish distinctly
 * rather than a generic catch-all.
 */
export type RoomKind =
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'kids'
  | 'nursery'
  | 'office'
  | 'study'
  | 'library'
  | 'guest'
  | 'bathroom'
  | 'laundry'
  | 'entryway'
  | 'hallway'
  | 'gym'
  | 'sunroom'
  | 'pantry'
  | 'closet';

export interface Vec2 {
  x: number;
  y: number;
}

/** One entry in the item library (20 per category). */
export interface FurnItem {
  id: string;
  name: string;
  type: FurnType;
  /** Sub-kind used by AI presets and 3D builders, e.g. "sofa", "pendant". */
  kind: string;
  style: string;
  tier: Tier;
  mount: Mount;
  /** Footprint width in meters (local X before rotation). */
  w: number;
  /** Footprint depth in meters (local Y before rotation). */
  d: number;
  /** Anchor height in meters for wall-mounted items (centre of the piece). */
  h: number;
  color: string;
  accent: string;
  /** 3 selectable colourways; index > 0 is a Max-only feature. */
  colors: [string, string, string];
  /** Variant details consumed by the 3D builders. */
  spec: Record<string, any>;
}

/**
 * A wall built with the 🧱 wall tool — free-standing segments anywhere on the
 * ground (partitions, outbuildings), independent of the room outline.
 */
export interface BuiltWall {
  id: string;
  a: Vec2;
  b: Vec2;
  kind: EdgeKind;
}

/**
 * One enclosed space on the plan. A plan holds any number of rooms; each keeps
 * its own outline, openings, purpose (`kind`) and display name, so AI Fill can
 * furnish a bedroom and a bathroom differently on the same floorplan.
 */
export interface Room {
  id: string;
  /** Outline in world meters, counter-clockwise or clockwise — both are fine. */
  poly: Vec2[];
  /** One entry per edge of `poly`: 'wall' | 'window' | 'door'. */
  openings: EdgeKind[];
  /** Purpose, which selects the AI Fill preset. */
  kind: RoomKind;
  /** Custom label shown in the UI; falls back to the kind's label when blank. */
  name: string;
}

/** An item dropped into the room. */
export interface PlacedItem {
  uid: string;
  itemId: string;
  /** The room this item belongs to — decides which outline it must stay inside. */
  roomId: string;
  /** Center of the footprint in world meters (same coords as 2D). */
  x: number;
  y: number;
  /** Rotation in degrees (counter-clockwise). Floor items use 0/90/180/270; wall items follow their edge angle. */
  rot: number;
  colorIdx: number;
}

export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, max: 2 };

export function tierUnlocked(itemTier: Tier, userTier: Tier): boolean {
  return TIER_RANK[itemTier] <= TIER_RANK[userTier];
}

export const TYPE_LABEL: Record<FurnType, string> = {
  seating: 'Seating',
  tables: 'Tables',
  storage: 'Storage & Casegoods',
  beds: 'Beds',
  ceilight: 'Ceiling Lights',
  walllight: 'Wall Lights',
  floorlamp: 'Floor & Task Lamps',
  archlight: 'Architectural Light',
  floorplants: 'Floor Plants',
  tableplants: 'Tabletop Plants',
  succulents: 'Succulents & Cacti',
  hangingplants: 'Hanging Plants',
  trees: 'Trees & Large Flora',
  textiles: 'Textiles & Soft Furnishings',
  walldecor: 'Wall Décor',
  tabletop: 'Tabletop Accents',
  functional: 'Functional Accents',
  vanity: 'Bathroom Vanities',
  bathtub: 'Bathtubs',
  shower: 'Shower Enclosures',
  toilet: 'Toilets',
  towelrack: 'Towel Racks',
  vamirror: 'Vanity Mirrors',
};

export const TYPE_ICON: Record<FurnType, string> = {
  seating: '\u{1FA91}',
  tables: '\u{1FAB5}',
  storage: '\u{1F5C4}️',
  beds: '\u{1F6CF}️',
  ceilight: '\u{1F4A1}',
  walllight: '\u{1F506}',
  floorlamp: '\u{1FA94}',
  archlight: '✨',
  floorplants: '\u{1F33F}',
  tableplants: '\u{1FAB4}',
  succulents: '\u{1F335}',
  hangingplants: '\u{1F343}',
  trees: '\u{1F333}',
  textiles: '\u{1F9F6}',
  walldecor: '\u{1F5BC}️',
  tabletop: '\u{1F3FA}',
  functional: '\u{1F525}',
  vanity: '\u{1FAA5}',
  bathtub: '\u{1F6C1}',
  shower: '\u{1F6BF}',
  toilet: '\u{1F6BD}',
  towelrack: '\u{1F9FB}',
  vamirror: '\u{1FA9E}',
};

export const TYPE_ORDER: FurnType[] = [
  'seating',
  'tables',
  'storage',
  'beds',
  'ceilight',
  'walllight',
  'floorlamp',
  'archlight',
  'floorplants',
  'tableplants',
  'succulents',
  'hangingplants',
  'trees',
  'textiles',
  'walldecor',
  'tabletop',
  'functional',
  'vanity',
  'bathtub',
  'shower',
  'toilet',
  'towelrack',
  'vamirror',
];

export const MOUNT_LABEL: Record<Mount, string> = {
  floor: 'Floor',
  wall: 'Wall-mounted',
  ceiling: 'Ceiling-mounted',
  surface: 'Tabletop',
};
