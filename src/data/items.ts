// RoomCraft item library — 25 categories × 20 items = 500 items.
// Tiers by row index: rows 0–2 free, 3–7 pro, 8–19 max.
// All source art is generated procedurally from these specs (CC0 / no
// external assets needed); specs drive both the 2D footprint and the 3D meshes.
// The bathroom suite (vanity, tub, shower, toilet, towel rack, vanity mirror)
// and the kitchen + dining sections close out the list.
//
// Height semantics (`h`) per mount:
//   floor    → total height (tables: top surface height → used as support)
//   wall     → anchor centre height above the floor
//   ceiling  → drop length below the ceiling
//   surface  → object height above the surface it sits on

import type { FurnItem, FurnType, Mount, Tier } from '../types';

const tierOf = (i: number): Tier => (i < 3 ? 'free' : i < 8 ? 'pro' : 'max');

/** Alternate colourways offered in the picker (index 1 & 2 are Max-only). */
const ALT = [
  '#8d99ae', '#c98a5e', '#5f8f7f', '#b08968', '#3d405b', '#d9a441',
  '#7d5a7a', '#2f6f5e', '#e0cdb5', '#45608a', '#a3b18a', '#c46a4a',
];

// ------------------------------------------------------------------- palettes
const WOOD = ['#b08968', '#8b5e3c', '#a67c52', '#6b4f3f', '#c9a97a', '#8a6b45', '#6b4226', '#d8c3a5'];
const WOOD_DARK = ['#4a3626', '#8a6b45', '#3d405b', '#5b4636', '#4b5563', '#37291f'];
const FABRIC = ['#93a3b8', '#5f8f7f', '#7d5a7a', '#b0685a', '#4b5563', '#a3b18a', '#c98a5e', '#5a6b8c', '#8d99ae', '#2f6f5e'];
const FABRIC_DARK = ['#5c6b80', '#3f6b5e', '#584553', '#7a4535', '#2f3646', '#6e7c58', '#8a5335', '#3f4f6c', '#4a5666', '#1f4f44'];
const LIGHT = ['#e0dcd5', '#d9d2c5', '#ece7dd', '#cfc7bb', '#e8e3d9', '#c9d2d9'];
const METAL = ['#4b5563', '#8a8f99', '#3d405b', '#6e7681', '#2f3e46', '#5b6573'];
const BRASS = ['#c9a227', '#b87333', '#8a6b45', '#c98a5e', '#b08968'];
const GREEN = ['#4f7a4a', '#3f6b3f', '#5f8f5a', '#7aa05f', '#46694f', '#6b8f4e', '#567d52'];
const POT = ['#c98a5e', '#b08968', '#e0dcd5', '#8a8f99', '#7d5a7a', '#d9d2c5', '#c46a4a', '#45608a'];
const CERAMIC = ['#e8e3d9', '#c9d2d9', '#d9c2a0', '#b9c4c9', '#e0d4bd', '#cbb89d'];
const ART = ['#5f8f7f', '#c46a4a', '#45608a', '#d9a441', '#7d5a7a', '#2f6f5e', '#a26769', '#4b5563'];

interface Pal {
  c: string[];
  a: string[];
}

interface Row {
  n: string;   // name
  k: string;   // kind (used by AI presets & 3D builders)
  s: string;   // style label
  w: number;   // footprint width (m)  — along the wall for wall items
  d: number;   // footprint depth (m)  — thickness for wall items
  h?: number;  // height / anchor / drop (see header)
  m?: Mount;   // mount override (defaults per category)
  c?: string;  // base colour override
  a?: string;  // accent colour override
  sp?: Record<string, any>; // 3D variant spec
}

function build(
  type: FurnType,
  defMount: Mount,
  pal: Pal,
  rows: Row[],
  shift = 0,
): FurnItem[] {
  if (rows.length !== 20) throw new Error(`${type}: expected 20 rows, got ${rows.length}`);
  return rows.map((r, i) => {
    const mount = r.m ?? defMount;
    const c = r.c ?? pal.c[(i * 3 + shift) % pal.c.length];
    let a = r.a ?? pal.a[(i * 5 + shift + 1) % pal.a.length];
    if (a === c) a = pal.a[(i * 5 + shift + 2) % pal.a.length];
    let alt1 = ALT[(i * 2 + 1) % ALT.length];
    let alt2 = ALT[(i * 5 + 4) % ALT.length];
    if (alt1 === c) alt1 = ALT[(i * 2 + 2) % ALT.length];
    if (alt2 === c || alt2 === alt1) alt2 = ALT[(i * 5 + 7) % ALT.length];
    const h =
      r.h ?? (mount === 'wall' ? 1.5 : mount === 'ceiling' ? 0.5 : mount === 'surface' ? 0.3 : 1);
    return {
      id: `${type}-${i}`,
      name: r.n,
      type,
      kind: r.k,
      style: r.s,
      tier: tierOf(i),
      mount,
      w: r.w,
      d: r.d,
      h,
      color: c,
      accent: a,
      colors: [c, alt1, alt2] as [string, string, string],
      spec: r.sp ?? {},
    };
  });
}

// ------------------------------------------------------------------- seating
const SEATING = build('seating', 'floor', { c: [...FABRIC, ...LIGHT], a: FABRIC_DARK }, [
  { n: 'Nordic 3-Seat Sofa', k: 'sofa', s: 'Scandinavian', w: 2.1, d: 0.9, h: 0.85, sp: { seats: 3, seatH: 0.45 } },
  { n: 'Halo Accent Chair', k: 'accent', s: 'Mid-Century', w: 0.78, d: 0.8, h: 0.82, sp: { seatH: 0.42, arms: true, back: 0.6 } },
  { n: 'Elmwood Dining Chair', k: 'dining', s: 'Modern', w: 0.45, d: 0.5, h: 0.9, sp: { seatH: 0.45, back: 0.44 } },
  { n: 'Harbor Sectional', k: 'sectional', s: 'Contemporary', w: 2.9, d: 1.95, h: 0.85, sp: { seats: 4, chaise: true, seatH: 0.45 } },
  { n: 'Wren Loveseat', k: 'loveseat', s: 'Transitional', w: 1.5, d: 0.85, h: 0.82, sp: { seats: 2, seatH: 0.44 } },
  { n: 'Pico Armchair', k: 'armchair', s: 'Japandi', w: 0.76, d: 0.8, h: 0.8, sp: { seatH: 0.42, arms: true, back: 0.55 } },
  { n: 'Recline Lounger', k: 'recliner', s: 'Traditional', w: 0.9, d: 0.95, h: 1.02, sp: { seatH: 0.45, recline: 0.3, arms: true, back: 0.7 } },
  { n: 'Cube Storage Ottoman', k: 'ottoman', s: 'Minimalist', w: 0.55, d: 0.55, h: 0.42, sp: { seatH: 0.42, stool: true, legs: false } },
  { n: 'Woven Pouf', k: 'pouf', s: 'Bohemian', w: 0.5, d: 0.5, h: 0.38, sp: { seatH: 0.38, stool: true, legs: false } },
  { n: 'Counter Bar Stool', k: 'stool', s: 'Industrial', w: 0.38, d: 0.38, h: 0.72, sp: { seatH: 0.65, stool: true } },
  { n: 'Slate Hall Bench', k: 'bench', s: 'Farmhouse', w: 1.3, d: 0.42, h: 0.46, sp: { seatH: 0.45, stool: true } },
  { n: 'Riva Daybed', k: 'daybed', s: 'Coastal', w: 1.9, d: 0.85, h: 0.78, sp: { seats: 2, arms: false, back: 0.5, seatH: 0.45 } },
  { n: 'Lume Chaise Lounge', k: 'chaise', s: 'Luxury', w: 1.6, d: 0.72, h: 0.75, sp: { seatH: 0.4, recline: 0.35, legs: false, back: 0.55 } },
  { n: 'Curve Accent Chair', k: 'accent', s: 'Contemporary', w: 0.74, d: 0.76, h: 0.8, sp: { seatH: 0.4, arms: true, back: 0.58 } },
  { n: 'Union Leather Sofa', k: 'sofa', s: 'Industrial', w: 2.2, d: 0.92, h: 0.86, sp: { seats: 3, seatH: 0.45, tuft: true } },
  { n: 'Studio Dining Chair', k: 'dining', s: 'Scandinavian', w: 0.46, d: 0.5, h: 0.88, sp: { seatH: 0.44, back: 0.46 } },
  { n: 'Nest Loveseat', k: 'loveseat', s: 'Organic Modern', w: 1.45, d: 0.84, h: 0.8, sp: { seats: 2, seatH: 0.44 } },
  { n: 'Loft Sectional', k: 'sectional', s: 'Modern', w: 3.1, d: 2.05, h: 0.84, sp: { seats: 5, chaise: true, seatH: 0.44 } },
  { n: 'Terrace Garden Bench', k: 'bench', s: 'Coastal', w: 1.1, d: 0.4, h: 0.48, sp: { seatH: 0.46, stool: true } },
  { n: 'Plumcushion Armchair', k: 'armchair', s: 'Glam', w: 0.8, d: 0.82, h: 0.84, sp: { seatH: 0.42, arms: true, back: 0.6, tuft: true } },
]);

// -------------------------------------------------------------------- tables
const TABLES = build('tables', 'floor', { c: [...WOOD, ...LIGHT], a: WOOD_DARK }, [
  { n: 'Orbit Coffee Table', k: 'coffee', s: 'Mid-Century', w: 1.1, d: 0.6, h: 0.42, sp: { legs: 'taper' } },
  { n: 'Halo Side Table', k: 'side', s: 'Scandinavian', w: 0.5, d: 0.5, h: 0.55, sp: { legs: 'hairpin' } },
  { n: 'Anchor Work Desk', k: 'desk', s: 'Industrial', w: 1.4, d: 0.68, h: 0.75, sp: { legs: 'block', apron: true } },
  { n: 'Grove Dining Table', k: 'dining', s: 'Transitional', w: 1.6, d: 0.9, h: 0.76, sp: { legs: 'block', apron: true } },
  { n: 'Plinth Console', k: 'console', s: 'Minimalist', w: 1.2, d: 0.35, h: 0.8, sp: { legs: 'block' } },
  { n: 'Column Accent Table', k: 'accent', s: 'Traditional', w: 0.48, d: 0.48, h: 0.58, sp: { round: true, legs: 'pedestal' } },
  { n: 'Nook Nested Tables', k: 'nested', s: 'Contemporary', w: 0.7, d: 0.6, h: 0.5, sp: { legs: 'hairpin' } },
  { n: 'Vanity Desk', k: 'vanity', s: 'Glam', w: 1.1, d: 0.45, h: 0.75, sp: { legs: 'taper', apron: true } },
  { n: 'Ellipse Coffee Table', k: 'coffee', s: 'Contemporary', w: 1.25, d: 0.65, h: 0.4, sp: { legs: 'taper' } },
  { n: 'Bistro Round Table', k: 'pedestal', s: 'Traditional', w: 0.95, d: 0.95, h: 0.74, sp: { round: true, legs: 'pedestal' } },
  { n: 'Slate Coffee Table', k: 'coffee', s: 'Industrial', w: 1.2, d: 0.7, h: 0.44, sp: { legs: 'block' } },
  { n: 'C-Table', k: 'side', s: 'Modern', w: 0.6, d: 0.45, h: 0.65, sp: { legs: 'cframe' } },
  { n: 'Extendable Dining', k: 'dining', s: 'Modern', w: 1.9, d: 0.95, h: 0.76, sp: { legs: 'block', apron: true } },
  { n: 'Slim Hall Console', k: 'console', s: 'Japandi', w: 1.0, d: 0.32, h: 0.78, sp: { legs: 'taper' } },
  { n: 'Marble Pedestal Table', k: 'accent', s: 'Luxury', w: 0.5, d: 0.5, h: 0.55, sp: { round: true, legs: 'pedestal' } },
  { n: 'Sprout Kids Table', k: 'accent', s: 'Playful', w: 0.9, d: 0.6, h: 0.55, sp: { legs: 'block' } },
  { n: 'Walnut Writing Desk', k: 'desk', s: 'Mid-Century', w: 1.25, d: 0.62, h: 0.74, sp: { legs: 'taper', apron: true } },
  { n: 'Live-Edge Dining', k: 'dining', s: 'Rustic', w: 2.1, d: 1.0, h: 0.76, sp: { legs: 'block' } },
  { n: 'Nesting Side Trio', k: 'nested', s: 'Minimalist', w: 0.6, d: 0.5, h: 0.5, sp: { legs: 'hairpin' } },
  { n: 'Glass Hall Console', k: 'console', s: 'Glam', w: 1.3, d: 0.36, h: 0.8, sp: { legs: 'block', glass: true } },
]);

// ------------------------------------------------------------------ storage
const STORAGE = build('storage', 'floor', { c: [...WOOD, ...LIGHT, ...METAL], a: WOOD_DARK }, [
  { n: 'Ladder Bookcase', k: 'bookcase', s: 'Scandinavian', w: 0.8, d: 0.32, h: 1.8, sp: { open: true, shelves: 5 } },
  { n: 'Nord Nightstand', k: 'nightstand', s: 'Minimalist', w: 0.45, d: 0.4, h: 0.55, sp: { drawers: 1 } },
  { n: 'Slate Six-Drawer Dresser', k: 'dresser', s: 'Modern', w: 1.3, d: 0.5, h: 0.9, sp: { drawers: 6 } },
  { n: 'Atlas Shelving Unit', k: 'shelving', s: 'Industrial', w: 1.0, d: 0.35, h: 1.85, sp: { open: true, shelves: 5 } },
  { n: 'Cane Credenza', k: 'credenza', s: 'Mid-Century', w: 1.6, d: 0.45, h: 0.75, sp: { doors: 3 } },
  { n: 'Harbor Sideboard', k: 'sideboard', s: 'Coastal', w: 1.5, d: 0.42, h: 0.8, sp: { doors: 3 } },
  { n: 'Hearth Buffet', k: 'buffet', s: 'Farmhouse', w: 1.7, d: 0.45, h: 0.86, sp: { doors: 2, drawers: 2 } },
  { n: 'Tower Chest of Drawers', k: 'chest', s: 'Traditional', w: 0.85, d: 0.5, h: 1.25, sp: { drawers: 7 } },
  { n: 'Grove Armoire', k: 'armoire', s: 'Rustic', w: 1.1, d: 0.55, h: 2.0, sp: { doors: 2, shelves: 2 } },
  { n: 'Linea Wardrobe', k: 'wardrobe', s: 'Japandi', w: 1.3, d: 0.6, h: 2.1, sp: { doors: 2 } },
  { n: 'Cubby Media Console', k: 'media', s: 'Contemporary', w: 1.7, d: 0.4, h: 0.5, sp: { doors: 2, shelves: 1 } },
  { n: 'Vitrine Display Cabinet', k: 'cabinet', s: 'Art Deco', w: 0.9, d: 0.4, h: 1.5, sp: { doors: 2, shelves: 4, glass: true } },
  { n: 'Cubic Cube Storage', k: 'shelving', s: 'Playful', w: 1.1, d: 0.35, h: 1.15, sp: { open: true, shelves: 6 } },
  { n: 'Milo Nightstand', k: 'nightstand', s: 'Bohemian', w: 0.5, d: 0.42, h: 0.6, sp: { drawers: 1 } },
  { n: 'Bank Six-Drawer Dresser', k: 'dresser', s: 'Transitional', w: 1.4, d: 0.52, h: 0.92, sp: { drawers: 6 } },
  { n: 'Loft Media Unit', k: 'media', s: 'Minimalist', w: 1.9, d: 0.42, h: 0.45, sp: { doors: 3 } },
  { n: 'Glass-Top Credenza', k: 'credenza', s: 'Luxury', w: 1.7, d: 0.45, h: 0.78, sp: { doors: 3, glass: true } },
  { n: 'Field Open Bookcase', k: 'bookcase', s: 'Farmhouse', w: 1.0, d: 0.34, h: 1.7, sp: { open: true, shelves: 6 } },
  { n: 'Petite Wardrobe', k: 'wardrobe', s: 'Traditional', w: 1.0, d: 0.55, h: 1.9, sp: { doors: 2 } },
  { n: 'Forge Sideboard', k: 'sideboard', s: 'Industrial', w: 1.5, d: 0.44, h: 0.82, sp: { doors: 3, drawers: 1 } },
]);

// --------------------------------------------------------------------- beds
const BEDS = build('beds', 'floor', { c: [...WOOD, ...LIGHT, ...FABRIC], a: WOOD_DARK }, [
  { n: 'Pine Platform Bed', k: 'platform', s: 'Scandinavian', w: 1.6, d: 2.05, h: 0.9, sp: { head: 0.9 } },
  { n: 'Cloud Panel Bed', k: 'panel', s: 'Transitional', w: 1.6, d: 2.1, h: 1.05, sp: { head: 1.05 } },
  { n: 'Nest Upholstered Bed', k: 'upholstered', s: 'Contemporary', w: 1.7, d: 2.15, h: 1.15, sp: { head: 1.15, uphol: true, tuft: true } },
  { n: 'Loft Canopy Bed', k: 'canopy', s: 'Industrial', w: 1.6, d: 2.1, h: 2.0, sp: { head: 0.8, canopy: true } },
  { n: 'Willow Sleigh Bed', k: 'sleigh', s: 'Traditional', w: 1.65, d: 2.15, h: 1.15, sp: { head: 1.15, sleigh: true } },
  { n: 'Driftwood Daybed', k: 'daybed', s: 'Coastal', w: 1.0, d: 1.9, h: 0.7, sp: { head: 0.7 } },
  { n: 'Hide Murphy Bed', k: 'murphy', s: 'Minimalist', w: 1.5, d: 0.6, h: 2.0, sp: { head: 0.5, murphy: true } },
  { n: 'Slate Platform Bed', k: 'platform', s: 'Modern', w: 1.5, d: 2.0, h: 0.8, sp: { head: 0.8 } },
  { n: 'Signature Hotel Bed', k: 'panel', s: 'Luxury', w: 1.8, d: 2.15, h: 1.2, sp: { head: 1.2, uphol: true, tuft: true } },
  { n: 'Velvet Wing Bed', k: 'upholstered', s: 'Glam', w: 1.7, d: 2.2, h: 1.3, sp: { head: 1.3, uphol: true, tuft: true } },
  { n: 'Ironworks Canopy', k: 'canopy', s: 'Industrial', w: 1.65, d: 2.1, h: 2.0, sp: { head: 0.8, canopy: true, metal: true } },
  { n: 'Alpine Sleigh Bed', k: 'sleigh', s: 'Rustic', w: 1.7, d: 2.15, h: 1.2, sp: { head: 1.2, sleigh: true } },
  { n: 'Sprout Kids Bed', k: 'platform', s: 'Playful', w: 1.0, d: 1.9, h: 0.6, sp: { head: 0.6 } },
  { n: 'Storage Platform Bed', k: 'platform', s: 'Contemporary', w: 1.6, d: 2.1, h: 0.9, sp: { head: 0.9, storage: true } },
  { n: 'Driftwood Panel Bed', k: 'panel', s: 'Coastal', w: 1.55, d: 2.05, h: 0.95, sp: { head: 0.95 } },
  { n: 'Chapel Murphy Bed', k: 'murphy', s: 'Modern', w: 1.6, d: 0.62, h: 2.0, sp: { head: 0.5, murphy: true } },
  { n: 'Ivory Upholstered Bed', k: 'upholstered', s: 'Organic Modern', w: 1.65, d: 2.1, h: 1.1, sp: { head: 1.1, uphol: true } },
  { n: 'Regal Sleigh Bed', k: 'sleigh', s: 'Luxury', w: 1.75, d: 2.2, h: 1.25, sp: { head: 1.25, sleigh: true, tuft: true } },
  { n: 'Riverside Daybed', k: 'daybed', s: 'Bohemian', w: 1.1, d: 1.9, h: 0.75, sp: { head: 0.75 } },
  { n: 'Manor Canopy Bed', k: 'canopy', s: 'Farmhouse', w: 1.7, d: 2.15, h: 2.05, sp: { head: 1.0, canopy: true } },
]);

// -------------------------------------------------------------- ceiling lights
const CEILING = build('ceilight', 'ceiling', { c: [...LIGHT, ...METAL], a: [...BRASS, ...LIGHT] }, [
  { n: 'Halo Pendant', k: 'pendant', s: 'Scandinavian', w: 0.4, d: 0.4, h: 1.15, sp: { shade: 'dome' } },
  { n: 'Drum Flush Mount', k: 'flush', s: 'Modern', w: 0.45, d: 0.45, h: 0.14, sp: { shade: 'drum' } },
  { n: 'Dome Semi-Flush', k: 'semi', s: 'Transitional', w: 0.5, d: 0.5, h: 0.3, sp: { shade: 'dome' } },
  { n: 'Spoke Chandelier', k: 'chandelier', s: 'Mid-Century', w: 0.7, d: 0.7, h: 0.7, sp: { shade: 'cone', arms: 6 } },
  { n: 'Rail Track Light', k: 'track', s: 'Industrial', w: 1.1, d: 0.2, h: 0.18, sp: { heads: 3 } },
  { n: 'Wind Ceiling Fan', k: 'fan', s: 'Coastal', w: 1.2, d: 1.2, h: 0.4, sp: { blades: 5, light: true } },
  { n: 'Recessed Spot', k: 'recessed', s: 'Minimalist', w: 0.3, d: 0.3, h: 0.06, sp: { heads: 2 } },
  { n: 'Globe Pendant', k: 'pendant', s: 'Contemporary', w: 0.34, d: 0.34, h: 1.2, sp: { shade: 'globe' } },
  { n: 'Crystal Chandelier', k: 'chandelier', s: 'Glam', w: 0.75, d: 0.75, h: 0.8, sp: { shade: 'crystal', arms: 8 } },
  { n: 'Square Flush Light', k: 'flush', s: 'Minimalist', w: 0.4, d: 0.4, h: 0.12, sp: { shade: 'square' } },
  { n: 'Linen Semi-Flush', k: 'semi', s: 'Scandinavian', w: 0.5, d: 0.5, h: 0.28, sp: { shade: 'drum' } },
  { n: 'Industrial Cage Light', k: 'pendant', s: 'Industrial', w: 0.38, d: 0.38, h: 1.1, sp: { shade: 'cage' } },
  { n: 'Ring Chandelier', k: 'chandelier', s: 'Art Deco', w: 0.8, d: 0.8, h: 0.6, sp: { shade: 'ring', arms: 6 } },
  { n: 'Trio Track Light', k: 'track', s: 'Contemporary', w: 1.3, d: 0.2, h: 0.16, sp: { heads: 4 } },
  { n: 'Breeze Ceiling Fan', k: 'fan', s: 'Modern', w: 1.1, d: 1.1, h: 0.38, sp: { blades: 4, light: true } },
  { n: 'Globe Cluster Pendant', k: 'pendant', s: 'Playful', w: 0.5, d: 0.5, h: 1.2, sp: { shade: 'globe', globes: 3 } },
  { n: 'Opal Flush Disc', k: 'flush', s: 'Organic Modern', w: 0.5, d: 0.5, h: 0.15, sp: { shade: 'globe' } },
  { n: 'Paper Lantern Pendant', k: 'pendant', s: 'Japandi', w: 0.55, d: 0.55, h: 1.25, sp: { shade: 'lantern' } },
  { n: 'Step Recessed Pair', k: 'recessed', s: 'Traditional', w: 0.4, d: 0.3, h: 0.06, sp: { heads: 2 } },
  { n: 'Candle Chandelier', k: 'chandelier', s: 'Traditional', w: 0.65, d: 0.65, h: 0.75, sp: { shade: 'cone', arms: 6 } },
]);

// --------------------------------------------------------------- wall lights
const WALLLIGHT = build('walllight', 'wall', { c: [...METAL, ...BRASS], a: [...BRASS, ...LIGHT] }, [
  { n: 'Half-Moon Sconce', k: 'sconce', s: 'Modern', w: 0.22, d: 0.12, h: 1.6, sp: { shade: 'dome' } },
  { n: 'Double Vanity Bar', k: 'vanity', s: 'Contemporary', w: 0.5, d: 0.14, h: 1.7, sp: { heads: 2 } },
  { n: 'Gallery Picture Light', k: 'picture', s: 'Traditional', w: 0.55, d: 0.12, h: 1.75, sp: { shade: 'bar' } },
  { n: 'Swing-Arm Reading Lamp', k: 'swing', s: 'Industrial', w: 0.45, d: 0.35, h: 1.5, sp: { shade: 'cone' } },
  { n: 'Cylinder Sconce', k: 'sconce', s: 'Minimalist', w: 0.16, d: 0.13, h: 1.65, sp: { shade: 'tube' } },
  { n: 'Ribbon Vanity Light', k: 'vanity', s: 'Art Deco', w: 0.55, d: 0.14, h: 1.72, sp: { heads: 3 } },
  { n: 'Slim Picture Light', k: 'picture', s: 'Minimalist', w: 0.45, d: 0.1, h: 1.7, sp: { shade: 'bar' } },
  { n: 'Library Swing Lamp', k: 'swing', s: 'Traditional', w: 0.5, d: 0.4, h: 1.55, sp: { shade: 'cone' } },
  { n: 'Globe Wall Sconce', k: 'sconce', s: 'Organic Modern', w: 0.18, d: 0.16, h: 1.62, sp: { shade: 'globe' } },
  { n: 'Hollywood Vanity Bar', k: 'vanity', s: 'Glam', w: 0.6, d: 0.16, h: 1.7, sp: { heads: 5, bulbs: true } },
  { n: 'Brass Picture Bar', k: 'picture', s: 'Luxury', w: 0.5, d: 0.12, h: 1.72, sp: { shade: 'bar' } },
  { n: 'Bedside Swing Light', k: 'swing', s: 'Transitional', w: 0.4, d: 0.3, h: 1.45, sp: { shade: 'cone' } },
  { n: 'Fluted Sconce', k: 'sconce', s: 'Japandi', w: 0.2, d: 0.14, h: 1.6, sp: { shade: 'tube' } },
  { n: 'Twin Globe Sconce', k: 'sconce', s: 'Scandinavian', w: 0.3, d: 0.16, h: 1.66, sp: { shade: 'globe', globes: 2 } },
  { n: 'Exhibit Picture Light', k: 'picture', s: 'Industrial', w: 0.6, d: 0.13, h: 1.75, sp: { shade: 'bar' } },
  { n: 'Cove Vanity Light', k: 'vanity', s: 'Coastal', w: 0.5, d: 0.13, h: 1.68, sp: { heads: 2 } },
  { n: 'Pivot Wall Sconce', k: 'sconce', s: 'Playful', w: 0.24, d: 0.18, h: 1.64, sp: { shade: 'dome' } },
  { n: 'Angled Picture Light', k: 'picture', s: 'Rustic', w: 0.48, d: 0.12, h: 1.7, sp: { shade: 'bar' } },
  { n: 'Articulated Swing Lamp', k: 'swing', s: 'Contemporary', w: 0.46, d: 0.36, h: 1.52, sp: { shade: 'cone' } },
  { n: 'Torchère Sconce', k: 'sconce', s: 'Traditional', w: 0.19, d: 0.17, h: 1.68, sp: { shade: 'cone' } },
]);

// ------------------------------------------------------------- floor & task lamps
// Rows 1, 2 (table / desk lamps) are surface-mounted; the rest stand on the floor.
const LAMPS = build('floorlamp', 'floor', { c: [...LIGHT, ...METAL, ...BRASS], a: [...BRASS, ...LIGHT, ...METAL] }, [
  { n: 'Rise Floor Lamp', k: 'floor', s: 'Scandinavian', w: 0.36, d: 0.36, h: 1.55, sp: { shade: 'drum', pole: 'single' } },
  { n: 'Glow Table Lamp', k: 'table', s: 'Transitional', w: 0.28, d: 0.28, h: 0.5, m: 'surface', sp: { shade: 'dome', pole: 'single' } },
  { n: 'Pivot Desk Lamp', k: 'desk', s: 'Industrial', w: 0.34, d: 0.3, h: 0.45, m: 'surface', sp: { shade: 'cone', pole: 'single' } },
  { n: 'Arc Reader Lamp', k: 'reading', s: 'Mid-Century', w: 0.4, d: 1.0, h: 1.65, sp: { shade: 'dome', pole: 'arc' } },
  { n: 'Tripod Linen Lamp', k: 'floor', s: 'Organic Modern', w: 0.46, d: 0.46, h: 1.5, sp: { shade: 'drum', pole: 'tripod' } },
  { n: 'Torchiere Uplight', k: 'uplight', s: 'Contemporary', w: 0.3, d: 0.3, h: 1.75, sp: { shade: 'uplight', pole: 'single' } },
  { n: 'Marble Table Lamp', k: 'table', s: 'Luxury', w: 0.3, d: 0.3, h: 0.55, m: 'surface', sp: { shade: 'drum', pole: 'single' } },
  { n: 'Gooseneck Desk Lamp', k: 'desk', s: 'Modern', w: 0.32, d: 0.28, h: 0.42, m: 'surface', sp: { shade: 'cone', pole: 'single' } },
  { n: 'Column Floor Lamp', k: 'floor', s: 'Japandi', w: 0.4, d: 0.4, h: 1.6, sp: { shade: 'tower', pole: 'single' } },
  { n: 'Brass Arc Lamp', k: 'reading', s: 'Luxury', w: 0.42, d: 1.05, h: 1.7, sp: { shade: 'cone', pole: 'arc' } },
  { n: 'Mushroom Table Lamp', k: 'table', s: 'Retro', w: 0.3, d: 0.3, h: 0.45, m: 'surface', sp: { shade: 'dome', pole: 'single' } },
  { n: 'Slim LED Tower', k: 'floor', s: 'Minimalist', w: 0.25, d: 0.25, h: 1.7, sp: { shade: 'tower', pole: 'single' } },
  { n: 'Clamp Task Lamp', k: 'desk', s: 'Scandinavian', w: 0.3, d: 0.26, h: 0.44, m: 'surface', sp: { shade: 'cone', pole: 'single' } },
  { n: 'Reed Floor Lamp', k: 'floor', s: 'Coastal', w: 0.42, d: 0.42, h: 1.5, sp: { shade: 'drum', pole: 'single' } },
  { n: 'Linen Shade Lamp', k: 'table', s: 'Bohemian', w: 0.32, d: 0.32, h: 0.52, m: 'surface', sp: { shade: 'drum', pole: 'single' } },
  { n: 'Studio Task Lamp', k: 'desk', s: 'Industrial', w: 0.36, d: 0.32, h: 0.5, m: 'surface', sp: { shade: 'cone', pole: 'single' } },
  { n: 'Ceramic Dome Lamp', k: 'table', s: 'Playful', w: 0.29, d: 0.29, h: 0.48, m: 'surface', sp: { shade: 'dome', pole: 'single' } },
  { n: 'Beam Uplight', k: 'uplight', s: 'Industrial', w: 0.3, d: 0.3, h: 1.6, sp: { shade: 'uplight', pole: 'single' } },
  { n: 'Candlestick Floor Lamp', k: 'floor', s: 'Traditional', w: 0.34, d: 0.34, h: 1.65, sp: { shade: 'drum', pole: 'single' } },
  { n: 'Arch Brass Lamp', k: 'reading', s: 'Glam', w: 0.4, d: 1.0, h: 1.68, sp: { shade: 'globe', pole: 'arc' } },
]);

// --------------------------------------------------------- architectural lights
const ARCH = build('archlight', 'wall', { c: [...METAL, ...LIGHT], a: ['#f3e9c8', '#ffe9a8', '#e8e3d9'] }, [
  { n: 'Cove Glow Strip', k: 'cove', s: 'Minimalist', w: 1.6, d: 0.12, h: 2.5, sp: { style: 'strip' } },
  { n: 'Under-Cabinet Bar', k: 'undercab', s: 'Modern', w: 0.6, d: 0.1, h: 1.6, sp: { style: 'bar' } },
  { n: 'Toe-Kick LED Strip', k: 'ledstrip', s: 'Contemporary', w: 1.4, d: 0.08, h: 0.12, sp: { style: 'strip' } },
  { n: 'Stair Niche Light', k: 'step', s: 'Traditional', w: 0.18, d: 0.1, h: 0.5, sp: { style: 'step' } },
  { n: 'Cove Channel', k: 'cove', s: 'Japandi', w: 2.0, d: 0.13, h: 2.55, sp: { style: 'strip' } },
  { n: 'Cabinet Puck Bar', k: 'undercab', s: 'Scandinavian', w: 0.55, d: 0.1, h: 1.55, sp: { style: 'bar' } },
  { n: 'Neon Channel Strip', k: 'ledstrip', s: 'Playful', w: 1.2, d: 0.09, h: 0.2, sp: { style: 'strip' } },
  { n: 'Recessed Step Light', k: 'step', s: 'Minimalist', w: 0.16, d: 0.12, h: 0.45, sp: { style: 'step' } },
  { n: 'Perimeter Cove Light', k: 'cove', s: 'Luxury', w: 2.2, d: 0.14, h: 2.5, sp: { style: 'strip' } },
  { n: 'Under-Shelf Light', k: 'undercab', s: 'Industrial', w: 0.7, d: 0.1, h: 1.62, sp: { style: 'bar' } },
  { n: 'Rope Channel Strip', k: 'ledstrip', s: 'Rustic', w: 1.5, d: 0.1, h: 0.15, sp: { style: 'strip' } },
  { n: 'Path Marker Light', k: 'step', s: 'Contemporary', w: 0.2, d: 0.12, h: 0.4, sp: { style: 'step' } },
  { n: 'Floating Cove Light', k: 'cove', s: 'Contemporary', w: 1.8, d: 0.12, h: 2.48, sp: { style: 'strip' } },
  { n: 'Range Hood Light', k: 'undercab', s: 'Modern', w: 0.65, d: 0.11, h: 1.65, sp: { style: 'bar' } },
  { n: 'Accent LED Line', k: 'ledstrip', s: 'Industrial', w: 1.3, d: 0.08, h: 1.9, sp: { style: 'strip' } },
  { n: 'Step Marker Light', k: 'step', s: 'Farmhouse', w: 0.17, d: 0.11, h: 0.48, sp: { style: 'step' } },
  { n: 'Cove Profile Light', k: 'cove', s: 'Organic Modern', w: 1.9, d: 0.13, h: 2.52, sp: { style: 'strip' } },
  { n: 'Under-Cabinet Tape', k: 'undercab', s: 'Transitional', w: 0.6, d: 0.09, h: 1.58, sp: { style: 'bar' } },
  { n: 'Cabinet LED Strip', k: 'ledstrip', s: 'Scandinavian', w: 1.4, d: 0.09, h: 1.55, sp: { style: 'strip' } },
  { n: 'Wall Wash Niche', k: 'step', s: 'Glam', w: 0.22, d: 0.12, h: 0.55, sp: { style: 'step' } },
]);

// -------------------------------------------------------------- floor plants
const FLOORPLANTS = build('floorplants', 'floor', { c: GREEN, a: POT }, [
  { n: 'Monstera Deliciosa', k: 'monstera', s: 'Bohemian', w: 0.55, d: 0.55, h: 1.15, sp: { foliage: 'broad' } },
  { n: 'Snake Plant', k: 'snake', s: 'Minimalist', w: 0.4, d: 0.4, h: 0.85, sp: { foliage: 'blade' } },
  { n: 'ZZ Plant', k: 'zz', s: 'Contemporary', w: 0.45, d: 0.45, h: 0.95, sp: { foliage: 'bush' } },
  { n: 'Fiddle-Leaf Fig', k: 'fiddle', s: 'Organic Modern', w: 0.5, d: 0.5, h: 1.5, sp: { foliage: 'tree' } },
  { n: 'Areca Palm', k: 'palm', s: 'Coastal', w: 0.6, d: 0.6, h: 1.6, sp: { foliage: 'palm' } },
  { n: 'Boston Fern', k: 'fern', s: 'Traditional', w: 0.5, d: 0.5, h: 0.8, sp: { foliage: 'fern' } },
  { n: 'Dragon Tree', k: 'dracaena', s: 'Japandi', w: 0.45, d: 0.45, h: 1.3, sp: { foliage: 'blade' } },
  { n: 'Heartleaf Philodendron', k: 'philodendron', s: 'Bohemian', w: 0.5, d: 0.5, h: 1.0, sp: { foliage: 'broad' } },
  { n: 'Split-Leaf Monstera', k: 'monstera', s: 'Eclectic', w: 0.6, d: 0.6, h: 1.25, sp: { foliage: 'broad' } },
  { n: 'Majesty Palm', k: 'palm', s: 'Coastal', w: 0.65, d: 0.65, h: 1.7, sp: { foliage: 'palm' } },
  { n: 'Raven ZZ', k: 'zz', s: 'Industrial', w: 0.44, d: 0.44, h: 0.92, sp: { foliage: 'bush' } },
  { n: 'Little Fiddle Fig', k: 'fiddle', s: 'Scandinavian', w: 0.45, d: 0.45, h: 1.3, sp: { foliage: 'tree' } },
  { n: 'Sword Fern', k: 'fern', s: 'Farmhouse', w: 0.48, d: 0.48, h: 0.75, sp: { foliage: 'fern' } },
  { n: 'Lucky Bamboo', k: 'dracaena', s: 'Japandi', w: 0.35, d: 0.35, h: 1.0, sp: { foliage: 'blade' } },
  { n: 'Xanadu Philodendron', k: 'philodendron', s: 'Playful', w: 0.48, d: 0.48, h: 0.95, sp: { foliage: 'broad' } },
  { n: 'Parlor Palm', k: 'palm', s: 'Traditional', w: 0.5, d: 0.5, h: 1.4, sp: { foliage: 'palm' } },
  { n: 'Weeping Fig', k: 'fiddle', s: 'Transitional', w: 0.5, d: 0.5, h: 1.45, sp: { foliage: 'tree' } },
  { n: 'Button Fern', k: 'fern', s: 'Rustic', w: 0.42, d: 0.42, h: 0.7, sp: { foliage: 'fern' } },
  { n: 'Corn Plant', k: 'dracaena', s: 'Traditional', w: 0.48, d: 0.48, h: 1.5, sp: { foliage: 'blade' } },
  { n: 'Triangle Palm', k: 'palm', s: 'Eclectic', w: 0.62, d: 0.62, h: 1.65, sp: { foliage: 'palm' } },
]);

// ----------------------------------------------------------- tabletop plants
const TABLEPLANTS = build('tableplants', 'surface', { c: GREEN, a: POT }, [
  { n: 'Golden Pothos', k: 'pothos', s: 'Bohemian', w: 0.3, d: 0.3, h: 0.4, sp: { foliage: 'trailing' } },
  { n: 'Peace Lily', k: 'lily', s: 'Transitional', w: 0.28, d: 0.28, h: 0.45, sp: { foliage: 'broad' } },
  { n: 'Chinese Evergreen', k: 'evergreen', s: 'Modern', w: 0.3, d: 0.3, h: 0.42, sp: { foliage: 'broad' } },
  { n: 'Marble Queen Pothos', k: 'pothos', s: 'Scandinavian', w: 0.3, d: 0.3, h: 0.38, sp: { foliage: 'trailing' } },
  { n: 'Rattlesnake Calathea', k: 'calathea', s: 'Eclectic', w: 0.3, d: 0.3, h: 0.4, sp: { foliage: 'broad' } },
  { n: 'Parlor Palm Mini', k: 'palm', s: 'Traditional', w: 0.32, d: 0.32, h: 0.5, sp: { foliage: 'palm' } },
  { n: 'Polka Dot Plant', k: 'polka', s: 'Playful', w: 0.26, d: 0.26, h: 0.35, sp: { foliage: 'bush' } },
  { n: 'Heartleaf Philodendron', k: 'philodendron', s: 'Organic Modern', w: 0.3, d: 0.3, h: 0.4, sp: { foliage: 'trailing' } },
  { n: 'White Peace Lily', k: 'lily', s: 'Minimalist', w: 0.27, d: 0.27, h: 0.44, sp: { foliage: 'broad' } },
  { n: 'Satin Pothos', k: 'pothos', s: 'Japandi', w: 0.29, d: 0.29, h: 0.38, sp: { foliage: 'trailing' } },
  { n: 'Zebra Calathea', k: 'calathea', s: 'Bohemian', w: 0.3, d: 0.3, h: 0.42, sp: { foliage: 'broad' } },
  { n: 'Mini Areca Palm', k: 'palm', s: 'Coastal', w: 0.3, d: 0.3, h: 0.48, sp: { foliage: 'palm' } },
  { n: 'Red Aglaonema', k: 'evergreen', s: 'Glam', w: 0.3, d: 0.3, h: 0.42, sp: { foliage: 'broad' } },
  { n: 'Pink Polka Dot', k: 'polka', s: 'Retro', w: 0.25, d: 0.25, h: 0.34, sp: { foliage: 'bush' } },
  { n: 'Xanadu Philodendron', k: 'philodendron', s: 'Bohemian', w: 0.32, d: 0.32, h: 0.45, sp: { foliage: 'broad' } },
  { n: 'Cast Iron Plant', k: 'evergreen', s: 'Industrial', w: 0.3, d: 0.3, h: 0.45, sp: { foliage: 'broad' } },
  { n: 'Neon Pothos', k: 'pothos', s: 'Playful', w: 0.29, d: 0.29, h: 0.37, sp: { foliage: 'trailing' } },
  { n: 'Prayer Plant', k: 'calathea', s: 'Eclectic', w: 0.28, d: 0.28, h: 0.38, sp: { foliage: 'broad' } },
  { n: 'Silver Queen', k: 'evergreen', s: 'Contemporary', w: 0.3, d: 0.3, h: 0.44, sp: { foliage: 'broad' } },
  { n: 'Lady Palm', k: 'palm', s: 'Luxury', w: 0.33, d: 0.33, h: 0.52, sp: { foliage: 'palm' } },
]);

// ------------------------------------------------------- succulents & cacti
const SUCCULENTS = build('succulents', 'surface', { c: GREEN, a: POT }, [
  { n: 'Echeveria Rosette', k: 'echeveria', s: 'Organic Modern', w: 0.18, d: 0.18, h: 0.22, sp: { foliage: 'rosette' } },
  { n: 'Golden Barrel Cactus', k: 'cactus', s: 'Bohemian', w: 0.18, d: 0.18, h: 0.3, sp: { foliage: 'cactus' } },
  { n: 'Aloe Vera Pot', k: 'aloe', s: 'Minimalist', w: 0.2, d: 0.2, h: 0.28, sp: { foliage: 'blade' } },
  { n: 'Zebra Haworthia', k: 'haworthia', s: 'Scandinavian', w: 0.16, d: 0.16, h: 0.24, sp: { foliage: 'blade' } },
  { n: 'Jade Plant', k: 'jade', s: 'Japandi', w: 0.24, d: 0.24, h: 0.35, sp: { foliage: 'bush' } },
  { n: 'Christmas Cactus', k: 'cactus', s: 'Traditional', w: 0.2, d: 0.2, h: 0.26, sp: { foliage: 'cactus' } },
  { n: 'Blue Echeveria', k: 'echeveria', s: 'Coastal', w: 0.17, d: 0.17, h: 0.2, sp: { foliage: 'rosette' } },
  { n: 'Spider Aloe', k: 'aloe', s: 'Eclectic', w: 0.2, d: 0.2, h: 0.3, sp: { foliage: 'blade' } },
  { n: 'Pearl Haworthia', k: 'haworthia', s: 'Minimalist', w: 0.15, d: 0.15, h: 0.22, sp: { foliage: 'rosette' } },
  { n: 'Dwarf Jade', k: 'jade', s: 'Bohemian', w: 0.22, d: 0.22, h: 0.32, sp: { foliage: 'bush' } },
  { n: 'Prickly Pear Cactus', k: 'cactus', s: 'Rustic', w: 0.24, d: 0.24, h: 0.4, sp: { foliage: 'cactus' } },
  { n: 'Echeveria Lola', k: 'echeveria', s: 'Glam', w: 0.18, d: 0.18, h: 0.21, sp: { foliage: 'rosette' } },
  { n: 'Tiger Aloe', k: 'aloe', s: 'Playful', w: 0.19, d: 0.19, h: 0.29, sp: { foliage: 'blade' } },
  { n: 'Haworthia Fasciata', k: 'haworthia', s: 'Contemporary', w: 0.16, d: 0.16, h: 0.25, sp: { foliage: 'blade' } },
  { n: 'Willow Jade', k: 'jade', s: 'Transitional', w: 0.26, d: 0.26, h: 0.38, sp: { foliage: 'bush' } },
  { n: 'Cactus Trio', k: 'cactus', s: 'Farmhouse', w: 0.28, d: 0.2, h: 0.3, sp: { foliage: 'cactus' } },
  { n: 'Painted Echeveria', k: 'echeveria', s: 'Playful', w: 0.18, d: 0.18, h: 0.22, sp: { foliage: 'rosette' } },
  { n: 'Aloe Middleton', k: 'aloe', s: 'Luxury', w: 0.2, d: 0.2, h: 0.3, sp: { foliage: 'blade' } },
  { n: 'Haworthia Cooperi', k: 'haworthia', s: 'Organic Modern', w: 0.15, d: 0.15, h: 0.21, sp: { foliage: 'rosette' } },
  { n: 'Jade Bonsai', k: 'jade', s: 'Traditional', w: 0.28, d: 0.28, h: 0.4, sp: { foliage: 'bush' } },
]);

// ---------------------------------------------------------- hanging plants
const HANGING = build('hangingplants', 'ceiling', { c: GREEN, a: POT }, [
  { n: 'String of Pearls', k: 'pearls', s: 'Bohemian', w: 0.3, d: 0.3, h: 0.75, sp: { foliage: 'trailing' } },
  { n: 'English Ivy Hanger', k: 'ivy', s: 'Traditional', w: 0.32, d: 0.32, h: 0.7, sp: { foliage: 'trailing' } },
  { n: 'Boston Fern Hanger', k: 'fern', s: 'Coastal', w: 0.36, d: 0.36, h: 0.65, sp: { foliage: 'fern' } },
  { n: 'Trailing Pothos', k: 'pothos', s: 'Organic Modern', w: 0.34, d: 0.34, h: 0.7, sp: { foliage: 'trailing' } },
  { n: "Burro's Tail", k: 'burro', s: 'Japandi', w: 0.28, d: 0.28, h: 0.8, sp: { foliage: 'trailing' } },
  { n: 'String of Bananas', k: 'pearls', s: 'Playful', w: 0.3, d: 0.3, h: 0.75, sp: { foliage: 'trailing' } },
  { n: 'Variegated Ivy', k: 'ivy', s: 'Scandinavian', w: 0.32, d: 0.32, h: 0.72, sp: { foliage: 'trailing' } },
  { n: 'Maidenhair Fern Hanger', k: 'fern', s: 'Transitional', w: 0.34, d: 0.34, h: 0.68, sp: { foliage: 'fern' } },
  { n: 'Neon Pothos Hanger', k: 'pothos', s: 'Playful', w: 0.33, d: 0.33, h: 0.7, sp: { foliage: 'trailing' } },
  { n: 'Ruby Necklaces', k: 'burro', s: 'Glam', w: 0.29, d: 0.29, h: 0.78, sp: { foliage: 'trailing' } },
  { n: 'String of Hearts', k: 'pearls', s: 'Bohemian', w: 0.28, d: 0.28, h: 0.76, sp: { foliage: 'trailing' } },
  { n: 'Needlepoint Ivy', k: 'ivy', s: 'Industrial', w: 0.31, d: 0.31, h: 0.7, sp: { foliage: 'trailing' } },
  { n: 'Leatherleaf Fern', k: 'fern', s: 'Rustic', w: 0.35, d: 0.35, h: 0.66, sp: { foliage: 'fern' } },
  { n: 'Satin Pothos Hanger', k: 'pothos', s: 'Japandi', w: 0.33, d: 0.33, h: 0.72, sp: { foliage: 'trailing' } },
  { n: 'Sedum Burrito', k: 'burro', s: 'Minimalist', w: 0.27, d: 0.27, h: 0.8, sp: { foliage: 'trailing' } },
  { n: 'String of Dolphins', k: 'pearls', s: 'Coastal', w: 0.3, d: 0.3, h: 0.74, sp: { foliage: 'trailing' } },
  { n: 'Golden Ivy', k: 'ivy', s: 'Farmhouse', w: 0.32, d: 0.32, h: 0.7, sp: { foliage: 'trailing' } },
  { n: 'Asplenium Hanger', k: 'fern', s: 'Contemporary', w: 0.35, d: 0.35, h: 0.64, sp: { foliage: 'fern' } },
  { n: 'Philodendron Trail', k: 'pothos', s: 'Eclectic', w: 0.34, d: 0.34, h: 0.7, sp: { foliage: 'trailing' } },
  { n: 'Donkey Tail', k: 'burro', s: 'Retro', w: 0.28, d: 0.28, h: 0.8, sp: { foliage: 'trailing' } },
]);

// -------------------------------------------------------------------- trees
const TREES = build('trees', 'floor', { c: GREEN, a: POT }, [
  { n: 'Silver Olive Tree', k: 'olive', s: 'Organic Modern', w: 0.7, d: 0.7, h: 1.7, sp: { foliage: 'tree' } },
  { n: 'Weeping Fig Tree', k: 'ficus', s: 'Bohemian', w: 0.65, d: 0.65, h: 1.8, sp: { foliage: 'tree' } },
  { n: 'Meyer Lemon Tree', k: 'citrus', s: 'Coastal', w: 0.55, d: 0.55, h: 1.5, sp: { foliage: 'tree', fruit: '#e0b441' } },
  { n: 'Tuscan Olive', k: 'olive', s: 'Rustic', w: 0.75, d: 0.75, h: 1.9, sp: { foliage: 'tree' } },
  { n: 'Benjamin Ficus', k: 'ficus', s: 'Scandinavian', w: 0.6, d: 0.6, h: 1.7, sp: { foliage: 'tree' } },
  { n: 'Calamondin Orange', k: 'citrus', s: 'Playful', w: 0.5, d: 0.5, h: 1.4, sp: { foliage: 'tree', fruit: '#e07b39' } },
  { n: 'Wild Olive', k: 'olive', s: 'Transitional', w: 0.72, d: 0.72, h: 1.8, sp: { foliage: 'tree' } },
  { n: 'Giant Ficus', k: 'ficus', s: 'Eclectic', w: 0.8, d: 0.8, h: 2.0, sp: { foliage: 'tree' } },
  { n: 'Bearss Lime Tree', k: 'citrus', s: 'Japandi', w: 0.52, d: 0.52, h: 1.45, sp: { foliage: 'tree', fruit: '#8fb844' } },
  { n: 'Olive Standard', k: 'olive', s: 'Farmhouse', w: 0.68, d: 0.68, h: 1.85, sp: { foliage: 'tree' } },
  { n: 'Ruby Ficus', k: 'ficus', s: 'Glam', w: 0.62, d: 0.62, h: 1.7, sp: { foliage: 'tree' } },
  { n: 'Kumquat Tree', k: 'citrus', s: 'Retro', w: 0.48, d: 0.48, h: 1.3, sp: { foliage: 'tree', fruit: '#e8933f' } },
  { n: 'Dwarf Olive', k: 'olive', s: 'Minimalist', w: 0.6, d: 0.6, h: 1.5, sp: { foliage: 'tree' } },
  { n: 'Ficus Nitida', k: 'ficus', s: 'Contemporary', w: 0.66, d: 0.66, h: 1.9, sp: { foliage: 'tree' } },
  { n: 'Grapefruit Tree', k: 'citrus', s: 'Luxury', w: 0.6, d: 0.6, h: 1.6, sp: { foliage: 'tree', fruit: '#e8c15a' } },
  { n: 'Ancient Olive', k: 'olive', s: 'Traditional', w: 0.85, d: 0.85, h: 2.1, sp: { foliage: 'tree' } },
  { n: 'Weeping Ficus', k: 'ficus', s: 'Industrial', w: 0.7, d: 0.7, h: 1.85, sp: { foliage: 'tree' } },
  { n: 'Mandarin Tree', k: 'citrus', s: 'Scandinavian', w: 0.5, d: 0.5, h: 1.4, sp: { foliage: 'tree', fruit: '#e8813a' } },
  { n: 'Olive Grove Pot', k: 'olive', s: 'Coastal', w: 0.7, d: 0.7, h: 1.75, sp: { foliage: 'tree' } },
  { n: 'Fiddle Grove', k: 'ficus', s: 'Farmhouse', w: 0.74, d: 0.74, h: 1.95, sp: { foliage: 'tree' } },
]);

// ----------------------------------------------------------------- textiles
// Rugs are flat (`spec.rug`); curtains/blinds/shades are wall + window-preferring.
const TEXTILES = build('textiles', 'floor', { c: [...FABRIC, ...LIGHT, ...ART], a: FABRIC_DARK }, [
  { n: 'Dune Area Rug', k: 'arearug', s: 'Scandinavian', w: 2.4, d: 1.7, h: 0.02, sp: { rug: true, border: true } },
  { n: 'Weave Runner', k: 'runner', s: 'Bohemian', w: 2.2, d: 0.7, h: 0.02, sp: { rug: true, stripe: true } },
  { n: 'Linen Throw Pillow', k: 'pillow', s: 'Organic Modern', w: 0.45, d: 0.45, h: 0.28, m: 'surface', sp: { pillow: true } },
  { n: 'Kilim Round Rug', k: 'roundrug', s: 'Eclectic', w: 1.8, d: 1.8, h: 0.02, sp: { rug: true, round: true, border: true } },
  { n: 'Chunky Knit Throw', k: 'throw', s: 'Coastal', w: 0.6, d: 0.45, h: 0.2, m: 'surface', sp: { folded: true } },
  { n: 'Sheer Curtain Panel', k: 'curtain', s: 'Minimalist', w: 1.4, d: 0.12, h: 1.5, m: 'wall', sp: { windowPref: true, length: 2.3 } },
  { n: 'Linen Drape Pair', k: 'curtain', s: 'Transitional', w: 2.4, d: 0.14, h: 1.5, m: 'wall', sp: { windowPref: true, length: 2.4, lined: true } },
  { n: 'Venetian Blind', k: 'blind', s: 'Modern', w: 1.3, d: 0.1, h: 1.55, m: 'wall', sp: { windowPref: true, length: 1.4 } },
  { n: 'Roman Shade', k: 'shade', s: 'Traditional', w: 1.3, d: 0.1, h: 1.6, m: 'wall', sp: { windowPref: true, length: 1.3 } },
  { n: 'Velvet Seat Cushion', k: 'seatcushion', s: 'Glam', w: 0.42, d: 0.42, h: 0.1, m: 'surface', sp: { cushion: true } },
  { n: 'Moroccan Floor Cushion', k: 'floorcushion', s: 'Bohemian', w: 0.55, d: 0.55, h: 0.25, sp: { cushion: true } },
  { n: 'Silk Table Runner', k: 'tablerunner', s: 'Luxury', w: 0.9, d: 0.3, h: 0.05, m: 'surface', sp: { runner: true } },
  { n: 'Horizon Wool Rug', k: 'arearug', s: 'Transitional', w: 2.6, d: 1.8, h: 0.02, sp: { rug: true, border: true } },
  { n: 'Farmhouse Runner', k: 'runner', s: 'Farmhouse', w: 2.4, d: 0.7, h: 0.02, sp: { rug: true, stripe: true } },
  { n: 'Velvet Throw Pillow', k: 'pillow', s: 'Glam', w: 0.48, d: 0.48, h: 0.3, m: 'surface', sp: { pillow: true } },
  { n: 'Mohair Throw', k: 'throw', s: 'Scandinavian', w: 0.58, d: 0.44, h: 0.18, m: 'surface', sp: { folded: true } },
  { n: 'Blackout Curtain', k: 'curtain', s: 'Contemporary', w: 2.4, d: 0.14, h: 1.5, m: 'wall', sp: { windowPref: true, length: 2.4, lined: true } },
  { n: 'Bamboo Blind', k: 'blind', s: 'Coastal', w: 1.3, d: 0.1, h: 1.55, m: 'wall', sp: { windowPref: true, length: 1.4 } },
  { n: 'Cellular Shade', k: 'shade', s: 'Minimalist', w: 1.4, d: 0.1, h: 1.6, m: 'wall', sp: { windowPref: true, length: 1.4 } },
  { n: 'Woven Floor Cushion', k: 'floorcushion', s: 'Japandi', w: 0.6, d: 0.6, h: 0.28, sp: { cushion: true } },
]);

// -------------------------------------------------------------- wall décor
const WALLDECOR = build('walldecor', 'wall', { c: ART, a: [...WOOD_DARK, ...METAL] }, [
  { n: 'Horizon Print', k: 'artwork', s: 'Minimalist', w: 0.7, d: 0.06, h: 1.45, sp: { style: 'frame' } },
  { n: 'Round Wall Mirror', k: 'mirror', s: 'Bohemian', w: 0.6, d: 0.07, h: 1.6, sp: { style: 'mirror', round: true } },
  { n: 'Sunburst Clock', k: 'clock', s: 'Mid-Century', w: 0.45, d: 0.07, h: 1.75, sp: { style: 'clock', round: true } },
  { n: 'Abstract Canvas', k: 'canvas', s: 'Contemporary', w: 1.0, d: 0.07, h: 1.6, sp: { style: 'canvas' } },
  { n: 'Metal Wall Sculpture', k: 'sculpture', s: 'Industrial', w: 0.6, d: 0.12, h: 1.6, sp: { style: 'sculpt' } },
  { n: 'Floating Oak Shelf', k: 'shelf', s: 'Scandinavian', w: 0.9, d: 0.22, h: 1.4, sp: { style: 'shelf' } },
  { n: 'Woven Tapestry', k: 'tapestry', s: 'Bohemian', w: 1.1, d: 0.06, h: 1.6, sp: { style: 'tapestry' } },
  { n: 'Botanical Mural', k: 'wallpaper', s: 'Organic Modern', w: 1.6, d: 0.05, h: 1.5, sp: { style: 'mural' } },
  { n: 'Gallery Frame Print', k: 'artwork', s: 'Traditional', w: 0.6, d: 0.06, h: 1.45, sp: { style: 'frame' } },
  { n: 'Oval Mirror', k: 'mirror', s: 'Glam', w: 0.5, d: 0.07, h: 1.6, sp: { style: 'mirror' } },
  { n: 'Grid Wall Clock', k: 'clock', s: 'Industrial', w: 0.4, d: 0.07, h: 1.75, sp: { style: 'clock' } },
  { n: 'Triptych Canvas', k: 'canvas', s: 'Playful', w: 1.3, d: 0.07, h: 1.6, sp: { style: 'canvas' } },
  { n: 'Cube Wall Shelf', k: 'shelf', s: 'Modern', w: 0.5, d: 0.2, h: 1.5, sp: { style: 'shelf' } },
  { n: 'Macramé Hanging', k: 'tapestry', s: 'Coastal', w: 0.9, d: 0.06, h: 1.6, sp: { style: 'tapestry' } },
  { n: 'Arch Wall Panel', k: 'wallpaper', s: 'Japandi', w: 1.5, d: 0.05, h: 1.5, sp: { style: 'mural' } },
  { n: 'Brass Wall Discs', k: 'sculpture', s: 'Luxury', w: 0.55, d: 0.1, h: 1.6, sp: { style: 'sculpt' } },
  { n: 'Panoramic Print', k: 'artwork', s: 'Coastal', w: 1.1, d: 0.06, h: 1.45, sp: { style: 'frame' } },
  { n: 'Station Clock', k: 'clock', s: 'Traditional', w: 0.42, d: 0.07, h: 1.75, sp: { style: 'clock', round: true } },
  { n: 'Picture Ledge', k: 'shelf', s: 'Farmhouse', w: 1.0, d: 0.18, h: 1.45, sp: { style: 'shelf' } },
  { n: 'Geometric Wall Shapes', k: 'sculpture', s: 'Art Deco', w: 0.6, d: 0.12, h: 1.6, sp: { style: 'sculpt' } },
]);

// ------------------------------------------------------- tabletop accents
const TABLETOP = build('tabletop', 'surface', { c: CERAMIC, a: [...BRASS, ...ART, ...METAL] }, [
  { n: 'Stoneware Bowl', k: 'bowl', s: 'Japandi', w: 0.26, d: 0.26, h: 0.12 },
  { n: 'Ceramic Bud Vase', k: 'vase', s: 'Minimalist', w: 0.14, d: 0.14, h: 0.3 },
  { n: 'Brass Candle Holder', k: 'candle', s: 'Traditional', w: 0.18, d: 0.18, h: 0.32 },
  { n: 'Marble Tray', k: 'tray', s: 'Luxury', w: 0.42, d: 0.3, h: 0.06 },
  { n: 'Abstract Figurine', k: 'sculpture', s: 'Contemporary', w: 0.18, d: 0.16, h: 0.32 },
  { n: 'Iron Bookends', k: 'bookends', s: 'Industrial', w: 0.3, d: 0.16, h: 0.24 },
  { n: 'Reed Diffuser', k: 'diffuser', s: 'Organic Modern', w: 0.14, d: 0.14, h: 0.34 },
  { n: 'Keepsake Box', k: 'box', s: 'Traditional', w: 0.22, d: 0.16, h: 0.14 },
  { n: 'Design Books Stack', k: 'books', s: 'Contemporary', w: 0.26, d: 0.2, h: 0.2 },
  { n: 'Glass Bowl', k: 'bowl', s: 'Coastal', w: 0.28, d: 0.28, h: 0.14 },
  { n: 'Sculptural Vase', k: 'vase', s: 'Art Deco', w: 0.18, d: 0.18, h: 0.36 },
  { n: 'Candle Trio', k: 'candle', s: 'Farmhouse', w: 0.24, d: 0.18, h: 0.35 },
  { n: 'Woven Tray', k: 'tray', s: 'Bohemian', w: 0.38, d: 0.28, h: 0.08 },
  { n: 'Marble Orb', k: 'sculpture', s: 'Glam', w: 0.16, d: 0.16, h: 0.18 },
  { n: 'Brass Bookends', k: 'bookends', s: 'Luxury', w: 0.28, d: 0.15, h: 0.26 },
  { n: 'Porcelain Diffuser', k: 'diffuser', s: 'Scandinavian', w: 0.15, d: 0.15, h: 0.3 },
  { n: 'Jewelry Box', k: 'box', s: 'Glam', w: 0.2, d: 0.15, h: 0.12 },
  { n: 'Art Monographs', k: 'books', s: 'Minimalist', w: 0.28, d: 0.22, h: 0.22 },
  { n: 'Speckled Bowl', k: 'bowl', s: 'Playful', w: 0.24, d: 0.24, h: 0.13 },
  { n: 'Sculptural Knot', k: 'sculpture', s: 'Eclectic', w: 0.22, d: 0.18, h: 0.26 },
]);

// ------------------------------------------------------- functional accents
const FUNCTIONAL = build('functional', 'floor', { c: [...WOOD, ...METAL, ...LIGHT], a: WOOD_DARK }, [
  { n: 'Electric Fireplace', k: 'fireplace', s: 'Contemporary', w: 1.4, d: 0.45, h: 1.1, sp: { style: 'fire' } },
  { n: 'Folding Screen Divider', k: 'divider', s: 'Japandi', w: 1.6, d: 0.4, h: 1.7, sp: { style: 'panels', panels: 3 } },
  { n: 'Woven Basket', k: 'basket', s: 'Bohemian', w: 0.42, d: 0.42, h: 0.5, sp: { style: 'basket' } },
  { n: 'Hall Tree Coat Rack', k: 'coatrack', s: 'Industrial', w: 0.9, d: 0.35, h: 1.85, sp: { style: 'rack' } },
  { n: 'Umbrella Stand', k: 'umbrella', s: 'Traditional', w: 0.28, d: 0.28, h: 0.6, sp: { style: 'stand' } },
  { n: 'Linen Laundry Hamper', k: 'laundry', s: 'Scandinavian', w: 0.45, d: 0.45, h: 0.7, sp: { style: 'hamper' } },
  { n: 'Stone Fireplace', k: 'fireplace', s: 'Rustic', w: 1.6, d: 0.5, h: 1.3, sp: { style: 'fire' } },
  { n: 'Slatted Room Divider', k: 'divider', s: 'Modern', w: 1.5, d: 0.35, h: 1.8, sp: { style: 'panels', panels: 3 } },
  { n: 'Log Basket', k: 'basket', s: 'Farmhouse', w: 0.5, d: 0.4, h: 0.45, sp: { style: 'basket' } },
  { n: 'Standing Coat Rack', k: 'coatrack', s: 'Mid-Century', w: 0.5, d: 0.5, h: 1.75, sp: { style: 'rack' } },
  { n: 'Brass Umbrella Stand', k: 'umbrella', s: 'Luxury', w: 0.26, d: 0.26, h: 0.62, sp: { style: 'stand' } },
  { n: 'Rattan Hamper', k: 'laundry', s: 'Coastal', w: 0.48, d: 0.46, h: 0.72, sp: { style: 'hamper' } },
  { n: 'Stove Fireplace', k: 'fireplace', s: 'Industrial', w: 1.1, d: 0.5, h: 1.4, sp: { style: 'fire' } },
  { n: 'Glass Partition Screen', k: 'divider', s: 'Contemporary', w: 1.7, d: 0.35, h: 1.9, sp: { style: 'panels', panels: 3 } },
  { n: 'Firewood Basket', k: 'basket', s: 'Rustic', w: 0.5, d: 0.38, h: 0.42, sp: { style: 'basket' } },
  { n: 'Coat & Boot Rack', k: 'coatrack', s: 'Transitional', w: 0.8, d: 0.35, h: 1.8, sp: { style: 'rack' } },
  { n: 'Ceramic Umbrella Pot', k: 'umbrella', s: 'Playful', w: 0.3, d: 0.3, h: 0.65, sp: { style: 'stand' } },
  { n: 'Laundry Sorter', k: 'laundry', s: 'Modern', w: 0.6, d: 0.4, h: 0.85, sp: { style: 'hamper' } },
  { n: 'Corner Fireplace', k: 'fireplace', s: 'Traditional', w: 1.2, d: 0.5, h: 1.25, sp: { style: 'fire' } },
  { n: 'Beaded Divider', k: 'divider', s: 'Retro', w: 1.4, d: 0.3, h: 1.9, sp: { style: 'panels', panels: 3 } },
]);

// ------------------------------------------------------------------ vanities
// Bathroom cabinets with countertop, porcelain basin and chrome faucet.
// `h` is the rim height — every row ≤ 0.86 m (R89).
const VANITY = build('vanity', 'floor', { c: [...WOOD, ...LIGHT, ...FABRIC], a: [...LIGHT] }, [
  { n: 'Nordic Basin Vanity', k: 'vanity', s: 'Scandinavian', w: 0.9, d: 0.46, h: 0.85, sp: { style: 'single' } },
  { n: 'Double-Sink Oak Vanity', k: 'vanity', s: 'Modern', w: 1.2, d: 0.5, h: 0.86, sp: { style: 'double' } },
  { n: 'Floating Wall Vanity', k: 'vanity', s: 'Minimalist', w: 1.0, d: 0.42, h: 0.84, sp: { style: 'floating' } },
  { n: 'Console Sink Stand', k: 'vanity', s: 'Industrial', w: 0.72, d: 0.44, h: 0.86, sp: { style: 'console' } },
  { n: 'Walnut Single Vanity', k: 'vanity', s: 'Mid-Century', w: 0.8, d: 0.45, h: 0.85, sp: { style: 'single' } },
  { n: 'Wide Double Console', k: 'vanity', s: 'Contemporary', w: 1.3, d: 0.5, h: 0.86, sp: { style: 'double' } },
  { n: 'Petite Basin Vanity', k: 'vanity', s: 'Apartment', w: 0.65, d: 0.42, h: 0.84, sp: { style: 'single' } },
  { n: 'Raised Farmhouse Vanity', k: 'vanity', s: 'Farmhouse', w: 1.0, d: 0.52, h: 0.86, sp: { style: 'console' } },
  { n: 'Slimline Floating Basin', k: 'vanity', s: 'Japandi', w: 0.85, d: 0.4, h: 0.83, sp: { style: 'floating' } },
  { n: 'Graphite Double Vanity', k: 'vanity', s: 'Modern', w: 1.25, d: 0.5, h: 0.86, sp: { style: 'double' } },
  { n: 'Classic Pedestal Sink', k: 'vanity', s: 'Traditional', w: 0.55, d: 0.42, h: 0.85, sp: { style: 'pedestal' } },
  { n: 'Terrazzo Top Vanity', k: 'vanity', s: 'Playful', w: 0.95, d: 0.47, h: 0.86, sp: { style: 'single' } },
  { n: 'Brass Leg Washstand', k: 'vanity', s: 'Luxury', w: 0.9, d: 0.48, h: 0.86, sp: { style: 'console' } },
  { n: 'Twin Basin Suite', k: 'vanity', s: 'Transitional', w: 1.4, d: 0.52, h: 0.86, sp: { style: 'double' } },
  { n: 'Compact Floating Duo', k: 'vanity', s: 'Minimalist', w: 0.9, d: 0.4, h: 0.84, sp: { style: 'floating' } },
  { n: 'Oak Slab Vanity', k: 'vanity', s: 'Japandi', w: 1.1, d: 0.46, h: 0.85, sp: { style: 'single' } },
  { n: 'Cottage Doored Vanity', k: 'vanity', s: 'Cottage', w: 1.0, d: 0.5, h: 0.86, sp: { style: 'single' } },
  { n: 'Monobloc Bath Vanity', k: 'vanity', s: 'Contemporary', w: 1.15, d: 0.48, h: 0.85, sp: { style: 'double' } },
  { n: 'Wall-Spanning Washstand', k: 'vanity', s: 'Luxury', w: 1.5, d: 0.5, h: 0.86, sp: { style: 'double' } },
  { n: 'Stone Vessel Vanity', k: 'vanity', s: 'Spa', w: 0.88, d: 0.46, h: 0.84, sp: { style: 'single' } },
]);

// ----------------------------------------------------------------- bathtubs
// Freestanding / alcove tubs with a water fill and chrome hardware.
const BATHTUB = build('bathtub', 'floor', { c: [...CERAMIC, ...LIGHT], a: [...METAL] }, [
  { n: 'Stillwater Freestanding Tub', k: 'bathtub', s: 'Spa', w: 1.7, d: 0.75, h: 0.6, sp: { style: 'freestanding' } },
  { n: 'Slipper Soak Tub', k: 'bathtub', s: 'Traditional', w: 1.65, d: 0.72, h: 0.62, sp: { style: 'slipper' } },
  { n: 'Alcove Prime Tub', k: 'bathtub', s: 'Modern', w: 1.5, d: 0.7, h: 0.56, sp: { style: 'alcove' } },
  { n: 'Copper Bateau Tub', k: 'bathtub', s: 'Luxury', w: 1.7, d: 0.78, h: 0.6, sp: { style: 'freestanding', copper: true } },
  { n: 'Compact Soaking Tub', k: 'bathtub', s: 'Japandi', w: 1.4, d: 0.68, h: 0.62, sp: { style: 'freestanding' } },
  { n: 'Double-Ended Roll Top', k: 'bathtub', s: 'Victorian', w: 1.75, d: 0.8, h: 0.6, sp: { style: 'slipper' } },
  { n: 'Deep Japanese Ofuro', k: 'bathtub', s: 'Japandi', w: 1.2, d: 0.75, h: 0.68, sp: { style: 'freestanding' } },
  { n: 'Corner Soaker Tub', k: 'bathtub', s: 'Contemporary', w: 1.55, d: 0.9, h: 0.58, sp: { style: 'alcove' } },
  { n: 'Matte Stone Tub', k: 'bathtub', s: 'Minimalist', w: 1.6, d: 0.74, h: 0.58, sp: { style: 'freestanding' } },
  { n: 'Clawfoot Roll Top', k: 'bathtub', s: 'Traditional', w: 1.7, d: 0.76, h: 0.62, sp: { style: 'slipper', feet: true } },
  { n: 'Air Jet Therapy Tub', k: 'bathtub', s: 'Modern', w: 1.8, d: 0.85, h: 0.58, sp: { style: 'alcove' } },
  { n: 'Freestanding Petal Tub', k: 'bathtub', s: 'Luxury', w: 1.68, d: 0.8, h: 0.64, sp: { style: 'freestanding' } },
  { n: 'Shower Bath Combo', k: 'bathtub', s: 'Practical', w: 1.7, d: 0.72, h: 0.56, sp: { style: 'alcove', screen: true } },
  { n: 'Slimline Tub', k: 'bathtub', s: 'Apartment', w: 1.5, d: 0.66, h: 0.56, sp: { style: 'freestanding' } },
  { n: 'Speckled Terrazzo Tub', k: 'bathtub', s: 'Playful', w: 1.62, d: 0.76, h: 0.6, sp: { style: 'freestanding' } },
  { n: 'Cast Iron Soaker', k: 'bathtub', s: 'Farmhouse', w: 1.66, d: 0.74, h: 0.6, sp: { style: 'slipper' } },
  { n: 'Infinity Rim Tub', k: 'bathtub', s: 'Luxury', w: 1.78, d: 0.82, h: 0.62, sp: { style: 'freestanding' } },
  { n: 'Walk-In Soak Tub', k: 'bathtub', s: 'Accessible', w: 1.3, d: 0.78, h: 0.72, sp: { style: 'alcove', door: true } },
  { n: 'Outdoor Bateau', k: 'bathtub', s: 'Rustic', w: 1.72, d: 0.78, h: 0.6, sp: { style: 'freestanding', copper: true } },
  { n: 'Square Soaking Tub', k: 'bathtub', s: 'Minimalist', w: 1.58, d: 0.78, h: 0.58, sp: { style: 'alcove' } },
]);

// --------------------------------------------------------- shower enclosures
// Glass panels + base tray + chrome shower column. Footprint ≥ 0.8 m so the
// stall can enclose a 76 cm circle (R92).
const SHOWER = build('shower', 'floor', { c: [...LIGHT, ...CERAMIC], a: [...METAL] }, [
  { n: 'Frameless Corner Shower', k: 'shower', s: 'Modern', w: 0.9, d: 0.9, h: 2.0, sp: { style: 'corner' } },
  { n: 'Sliding Door Enclosure', k: 'shower', s: 'Contemporary', w: 1.0, d: 0.85, h: 2.0, sp: { style: 'corner', slide: true } },
  { n: 'Walk-In Rain Shower', k: 'shower', s: 'Spa', w: 1.2, d: 0.95, h: 2.1, sp: { style: 'walkin' } },
  { n: 'Pivot Door Enclosure', k: 'shower', s: 'Modern', w: 0.9, d: 0.9, h: 1.95, sp: { style: 'corner' } },
  { n: 'Frosted Corner Shower', k: 'shower', s: 'Practical', w: 0.95, d: 0.95, h: 2.0, sp: { style: 'corner', frost: true } },
  { n: 'Subway Tile Shower', k: 'shower', s: 'Farmhouse', w: 1.0, d: 0.9, h: 2.0, sp: { style: 'corner', tile: true } },
  { n: 'Brass Framed Shower', k: 'shower', s: 'Traditional', w: 0.9, d: 0.9, h: 2.0, sp: { style: 'corner', brass: true } },
  { n: 'Compact Cubicle', k: 'shower', s: 'Apartment', w: 0.8, d: 0.8, h: 1.95, sp: { style: 'corner' } },
  { n: 'Double Rain Head Shower', k: 'shower', s: 'Luxury', w: 1.1, d: 1.0, h: 2.1, sp: { style: 'walkin', rain: true } },
  { n: 'Tiled Wet Room Panel', k: 'shower', s: 'Japandi', w: 1.1, d: 0.9, h: 2.0, sp: { style: 'walkin', tile: true } },
  { n: 'Hinged Glass Enclosure', k: 'shower', s: 'Classic', w: 0.9, d: 0.85, h: 2.0, sp: { style: 'corner' } },
  { n: 'Black Frame Industrial', k: 'shower', s: 'Industrial', w: 1.0, d: 0.9, h: 2.05, sp: { style: 'corner', black: true } },
  { n: 'Steam Capsule Shower', k: 'shower', s: 'Futuristic', w: 1.0, d: 1.0, h: 2.1, sp: { style: 'corner', frost: true, rain: true } },
  { n: 'Slim Tray Cubicle', k: 'shower', s: 'Minimalist', w: 0.85, d: 0.85, h: 1.95, sp: { style: 'corner' } },
  { n: 'Crittall Grid Shower', k: 'shower', s: 'Industrial', w: 1.0, d: 0.9, h: 2.0, sp: { style: 'corner', black: true } },
  { n: 'Mosaic Floor Shower', k: 'shower', s: 'Bohemian', w: 0.95, d: 0.9, h: 2.0, sp: { style: 'corner', tile: true } },
  { n: 'Wide Sliding Enclosure', k: 'shower', s: 'Modern', w: 1.2, d: 0.9, h: 2.0, sp: { style: 'corner', slide: true } },
  { n: 'Clear Glass Quadrant', k: 'shower', s: 'Contemporary', w: 0.9, d: 0.9, h: 1.95, sp: { style: 'corner', frost: false } },
  { n: 'Hotel Rain Suite', k: 'shower', s: 'Luxury', w: 1.3, d: 1.0, h: 2.1, sp: { style: 'walkin', rain: true } },
  { n: 'Barrier Free Shower', k: 'shower', s: 'Accessible', w: 1.1, d: 1.0, h: 2.0, sp: { style: 'walkin' } },
]);

// -------------------------------------------------------------------- toilets
// Dual-piece ceramic bowl + seat + tank (or wall-hung cistern housing).
const TOILET = build('toilet', 'floor', { c: [...CERAMIC, ...LIGHT], a: [...METAL, ...LIGHT] }, [
  { n: 'Dual-Flush Close-Coupled', k: 'toilet', s: 'Modern', w: 0.4, d: 0.7, h: 0.78, sp: { style: 'two-piece' } },
  { n: 'Rimless Wall-Hung', k: 'toilet', s: 'Minimalist', w: 0.37, d: 0.55, h: 0.48, sp: { style: 'wall-hung' } },
  { n: 'Compact Elongated', k: 'toilet', s: 'Apartment', w: 0.38, d: 0.62, h: 0.74, sp: { style: 'one-piece' } },
  { n: 'Classic Two-Piece', k: 'toilet', s: 'Traditional', w: 0.44, d: 0.72, h: 0.8, sp: { style: 'two-piece' } },
  { n: 'Skirted Trapway Toilet', k: 'toilet', s: 'Modern', w: 0.42, d: 0.71, h: 0.78, sp: { style: 'one-piece' } },
  { n: 'Short Projection Toilet', k: 'toilet', s: 'Compact', w: 0.38, d: 0.6, h: 0.75, sp: { style: 'two-piece' } },
  { n: 'Smart Washlet Suite', k: 'toilet', s: 'Futuristic', w: 0.4, d: 0.72, h: 0.8, sp: { style: 'one-piece', bidet: true } },
  { n: 'Comfort Height Toilet', k: 'toilet', s: 'Accessible', w: 0.42, d: 0.7, h: 0.82, sp: { style: 'two-piece' } },
  { n: 'Wall-Hung Soft Close', k: 'toilet', s: 'Contemporary', w: 0.36, d: 0.54, h: 0.47, sp: { style: 'wall-hung' } },
  { n: 'Pedestal Back-to-Wall', k: 'toilet', s: 'Transitional', w: 0.4, d: 0.65, h: 0.77, sp: { style: 'one-piece' } },
  { n: 'Matte Black Detail Toilet', k: 'toilet', s: 'Industrial', w: 0.41, d: 0.7, h: 0.78, sp: { style: 'two-piece', black: true } },
  { n: 'Square Modern Toilet', k: 'toilet', s: 'Minimalist', w: 0.4, d: 0.68, h: 0.76, sp: { style: 'one-piece', square: true } },
  { n: 'Tiny Half Bath Toilet', k: 'toilet', s: 'Compact', w: 0.36, d: 0.58, h: 0.74, sp: { style: 'two-piece' } },
  { n: 'Dual Flush Round Bowl', k: 'toilet', s: 'Practical', w: 0.42, d: 0.66, h: 0.77, sp: { style: 'two-piece' } },
  { n: 'Bidet Combo Toilet', k: 'toilet', s: 'Luxury', w: 0.42, d: 0.73, h: 0.79, sp: { style: 'one-piece', bidet: true } },
  { n: 'Country Close-Coupled', k: 'toilet', s: 'Cottage', w: 0.45, d: 0.72, h: 0.8, sp: { style: 'two-piece' } },
  { n: 'Wall-Hung Rimless Wide', k: 'toilet', s: 'Modern', w: 0.4, d: 0.56, h: 0.49, sp: { style: 'wall-hung' } },
  { n: 'Soft Curve One-Piece', k: 'toilet', s: 'Japandi', w: 0.4, d: 0.69, h: 0.77, sp: { style: 'one-piece' } },
  { n: 'Hotel Grade Toilet', k: 'toilet', s: 'Hospitality', w: 0.43, d: 0.71, h: 0.79, sp: { style: 'two-piece' } },
  { n: 'Compact Wall-Hung', k: 'toilet', s: 'Apartment', w: 0.36, d: 0.52, h: 0.46, sp: { style: 'wall-hung' } },
]);

// --------------------------------------------------------------- towel racks
// Metallic wall frames carrying hung accent towels.
const TOWELRACK = build('towelrack', 'wall', { c: [...METAL, ...BRASS], a: [...FABRIC, ...LIGHT] }, [
  { n: 'Chrome Single Bar Rack', k: 'towelrack', s: 'Modern', w: 0.6, d: 0.1, h: 1.3, sp: { style: 'bars', bars: 1 } },
  { n: 'Double Bar Towel Rail', k: 'towelrack', s: 'Modern', w: 0.65, d: 0.12, h: 1.3, sp: { style: 'bars', bars: 2 } },
  { n: 'Heated Towel Ladder', k: 'towelrack', s: 'Luxury', w: 0.5, d: 0.12, h: 1.35, sp: { style: 'ladder', rungs: 5 } },
  { n: 'Brass Towel Ring', k: 'towelrack', s: 'Traditional', w: 0.4, d: 0.1, h: 1.25, sp: { style: 'ring' } },
  { n: 'Glass Shelf + Rail', k: 'towelrack', s: 'Contemporary', w: 0.6, d: 0.16, h: 1.3, sp: { style: 'shelf' } },
  { n: 'Folded Towel Shelf', k: 'towelrack', s: 'Spa', w: 0.55, d: 0.18, h: 1.35, sp: { style: 'shelf', stack: 3 } },
  { n: 'Matte Black Bar', k: 'towelrack', s: 'Industrial', w: 0.7, d: 0.1, h: 1.3, sp: { style: 'bars', bars: 1, black: true } },
  { n: 'Robe Hook Rail', k: 'towelrack', s: 'Minimalist', w: 0.5, d: 0.09, h: 1.4, sp: { style: 'hooks', hooks: 3 } },
  { n: 'Hotel Double Towel Bar', k: 'towelrack', s: 'Hospitality', w: 0.8, d: 0.14, h: 1.3, sp: { style: 'bars', bars: 2 } },
  { n: 'Copper Towel Ring', k: 'towelrack', s: 'Bohemian', w: 0.4, d: 0.1, h: 1.25, sp: { style: 'ring' } },
  { n: 'Ladder Lean Rail', k: 'towelrack', s: 'Japandi', w: 0.55, d: 0.14, h: 1.3, sp: { style: 'ladder', rungs: 4 } },
  { n: 'Niche Towel Bar', k: 'towelrack', s: 'Minimalist', w: 0.6, d: 0.1, h: 1.2, sp: { style: 'bars', bars: 1 } },
  { n: 'Brass Hook Row', k: 'towelrack', s: 'Traditional', w: 0.45, d: 0.09, h: 1.35, sp: { style: 'hooks', hooks: 4 } },
  { n: 'Waffle Towel Set', k: 'towelrack', s: 'Spa', w: 0.62, d: 0.13, h: 1.3, sp: { style: 'bars', bars: 2, waffle: true } },
  { n: 'Swivel Towel Arm', k: 'towelrack', s: 'Practical', w: 0.45, d: 0.16, h: 1.3, sp: { style: 'bars', bars: 1 } },
  { n: 'Wood + Steel Rail', k: 'towelrack', s: 'Industrial', w: 0.7, d: 0.11, h: 1.3, sp: { style: 'bars', bars: 1, wood: true } },
  { n: 'Wide Heated Ladder', k: 'towelrack', s: 'Luxury', w: 0.6, d: 0.13, h: 1.4, sp: { style: 'ladder', rungs: 6 } },
  { n: 'Ring + Shelf Combo', k: 'towelrack', s: 'Transitional', w: 0.5, d: 0.15, h: 1.3, sp: { style: 'shelf' } },
  { n: 'Minimal Wire Rail', k: 'towelrack', s: 'Minimalist', w: 0.55, d: 0.08, h: 1.3, sp: { style: 'bars', bars: 1 } },
  { n: 'Vanity Towel Bar', k: 'towelrack', s: 'Modern', w: 0.66, d: 0.1, h: 1.25, sp: { style: 'bars', bars: 2 } },
]);

// ------------------------------------------------------------- vanity mirrors
// Wall-mounted mirrors, several with an integrated LED lighting strip.
const VAMIRROR = build('vamirror', 'wall', { c: [...METAL, ...WOOD_DARK, ...BRASS], a: [...LIGHT] }, [
  { n: 'LED Backlit Mirror', k: 'mirror', s: 'Modern', w: 0.7, d: 0.06, h: 1.5, sp: { style: 'led' } },
  { n: 'Round Pivot Mirror', k: 'mirror', s: 'Japandi', w: 0.6, d: 0.06, h: 1.5, sp: { style: 'round' } },
  { n: 'Pill Rectangle Mirror', k: 'mirror', s: 'Minimalist', w: 0.6, d: 0.05, h: 1.5, sp: { style: 'pill' } },
  { n: 'Framed Oak Mirror', k: 'mirror', s: 'Scandinavian', w: 0.65, d: 0.06, h: 1.5, sp: { style: 'rect', wood: true } },
  { n: 'Brass Edge Mirror', k: 'mirror', s: 'Luxury', w: 0.7, d: 0.05, h: 1.5, sp: { style: 'rect' } },
  { n: 'Wide Double Vanity Mirror', k: 'mirror', s: 'Contemporary', w: 1.1, d: 0.06, h: 1.5, sp: { style: 'led' } },
  { n: 'Arched Wall Mirror', k: 'mirror', s: 'Traditional', w: 0.6, d: 0.06, h: 1.5, sp: { style: 'pill' } },
  { n: 'Black Frame Mirror', k: 'mirror', s: 'Industrial', w: 0.66, d: 0.06, h: 1.5, sp: { style: 'rect', black: true } },
  { n: 'Round Brass Mirror', k: 'mirror', s: 'Bohemian', w: 0.55, d: 0.06, h: 1.5, sp: { style: 'round' } },
  { n: 'Medicine Cabinet Mirror', k: 'mirror', s: 'Practical', w: 0.7, d: 0.13, h: 1.5, sp: { style: 'rect', cabinet: true } },
  { n: 'Sensor LED Pill Mirror', k: 'mirror', s: 'Futuristic', w: 0.6, d: 0.05, h: 1.5, sp: { style: 'pill', led: true } },
  { n: 'Soft Glow Oval Mirror', k: 'mirror', s: 'Spa', w: 0.62, d: 0.05, h: 1.5, sp: { style: 'round', led: true } },
  { n: 'Hotel Pill Mirror', k: 'mirror', s: 'Hospitality', w: 0.68, d: 0.06, h: 1.5, sp: { style: 'pill' } },
  { n: 'Walnut Framed Round', k: 'mirror', s: 'Mid-Century', w: 0.58, d: 0.06, h: 1.5, sp: { style: 'round', wood: true } },
  { n: 'Frameless Polished Mirror', k: 'mirror', s: 'Minimalist', w: 0.7, d: 0.04, h: 1.5, sp: { style: 'rect' } },
  { n: 'Skinny Full LED Mirror', k: 'mirror', s: 'Modern', w: 0.8, d: 0.05, h: 1.5, sp: { style: 'led' } },
  { n: 'Antique Brass Oval', k: 'mirror', s: 'Traditional', w: 0.56, d: 0.06, h: 1.5, sp: { style: 'round' } },
  { n: 'Rounded Square Mirror', k: 'mirror', s: 'Contemporary', w: 0.64, d: 0.05, h: 1.5, sp: { style: 'pill' } },
  { n: 'Gallery Glass Panel', k: 'mirror', s: 'Loft', w: 0.9, d: 0.05, h: 1.5, sp: { style: 'rect', black: true } },
  { n: 'Backlit Halo Mirror', k: 'mirror', s: 'Luxury', w: 0.66, d: 0.06, h: 1.5, sp: { style: 'led' } },
]);

// ---------------------------------------------------------------- kitchen
// The working kitchen: the box (cabinets, appliances, sink), the work surface
// (islands, peninsulas, carts) and the ventilation above it.
//
// Heights follow the same rule as the bathroom suite: `h` is the top surface
// for counter-height pieces (~0.88–0.95 m) so a table lamp or fruit bowl can
// actually be stood on them, and total height for appliances.
const KITCHEN = build('kitchen', 'floor', { c: [...METAL, ...LIGHT, ...WOOD], a: [...WOOD_DARK, ...METAL] }, [
  { n: 'French Door Fridge', k: 'fridge', s: 'Modern', w: 0.9, d: 0.75, h: 1.85, sp: { doors: 'french' } },
  { n: 'Base Cabinet Run', k: 'basecab', s: 'Shaker', w: 1.8, d: 0.6, h: 0.88, sp: { doors: 3 } },
  { n: 'Kitchen Island', k: 'island', s: 'Modern', w: 1.8, d: 0.9, h: 0.92, sp: { doors: 2 } },
  { n: 'Gas Range & Oven', k: 'range', s: 'Professional', w: 0.75, d: 0.65, h: 0.92, sp: { burners: 5 } },
  { n: 'Sink Base Unit', k: 'sinkbase', s: 'Shaker', w: 0.9, d: 0.6, h: 0.88, sp: { sink: 'under' } },
  { n: 'Tall Pantry Cabinet', k: 'pantry', s: 'Shaker', w: 0.6, d: 0.6, h: 2.1, sp: { doors: 1 } },
  { n: 'Wall Cabinet Double', k: 'wallcab', s: 'Shaker', w: 1.2, d: 0.35, h: 1.5, m: 'wall', sp: { doors: 2 } },
  { n: 'Kitchen Peninsula', k: 'peninsula', s: 'Contemporary', w: 1.6, d: 0.7, h: 0.92, sp: { doors: 1 } },
  { n: 'Range Hood', k: 'hood', s: 'Industrial', w: 0.75, d: 0.5, h: 1.7, m: 'wall', sp: { style: 'chimney' } },
  { n: 'Dishwasher Panel', k: 'dishwasher', s: 'Integrated', w: 0.6, d: 0.6, h: 0.88, sp: { style: 'panel' } },
  { n: 'Butcher Block Island', k: 'island', s: 'Farmhouse', w: 1.5, d: 0.8, h: 0.95, sp: { wood: true } },
  { n: 'Kitchen Cart', k: 'cart', s: 'Industrial', w: 0.8, d: 0.45, h: 0.9, sp: { wheels: 4 } },
  { n: 'Chest Freezer', k: 'freezer', s: 'Commercial', w: 0.9, d: 0.7, h: 0.9, sp: { lid: 'chest' } },
  { n: 'Drawer Bank', k: 'drawerbank', s: 'Shaker', w: 0.6, d: 0.6, h: 0.88, sp: { drawers: 3 } },
  { n: 'Open Shelf Unit', k: 'wallcab', s: 'Industrial', w: 0.9, d: 0.3, h: 1.4, m: 'wall', sp: { open: true } },
  { n: 'Built-in Microwave', k: 'microwave', s: 'Modern', w: 0.5, d: 0.4, h: 1.5, m: 'wall', sp: { style: 'built-in' } },
  { n: 'Induction Cooktop', k: 'cooktop', s: 'Minimalist', w: 0.6, d: 0.52, h: 0.9, sp: { zones: 4 } },
  { n: 'Wine Fridge', k: 'fridge', s: 'Luxury', w: 0.45, d: 0.55, h: 0.9, sp: { doors: 'glass' } },
  { n: 'Recycling Pull-out', k: 'recycle', s: 'Modern', w: 0.5, d: 0.55, h: 0.8, sp: { bins: 2 } },
  { n: 'Corner Base Cabinet', k: 'basecab', s: 'Traditional', w: 0.9, d: 0.9, h: 0.88, sp: { corner: true } },
]);

// ----------------------------------------------------------------- dining
// The dining room proper: tables of every shape, the storage that backs them
// (sideboards, china cabinets, wine racks) and the serving pieces that make a
// table look laid rather than bare.
const DINING = build('dining', 'floor', { c: [...WOOD, ...FABRIC, ...LIGHT], a: [...WOOD_DARK, ...BRASS] }, [
  { n: 'Extendable Oak Table', k: 'dining', s: 'Farmhouse', w: 1.8, d: 0.9, h: 0.75, sp: { leaf: true } },
  { n: 'Round Pedestal Table', k: 'round', s: 'Traditional', w: 1.2, d: 1.2, h: 0.75, sp: { base: 'pedestal' } },
  { n: 'Buffet Sideboard', k: 'buffet', s: 'Mid-Century', w: 1.6, d: 0.45, h: 0.85, sp: { doors: 3 } },
  { n: 'Trestle Farmhouse Table', k: 'trestle', s: 'Farmhouse', w: 2.0, d: 0.9, h: 0.76, sp: { base: 'trestle' } },
  { n: 'Bar Height Table', k: 'bar', s: 'Industrial', w: 1.4, d: 0.7, h: 1.05, sp: { base: 'trestle' } },
  { n: 'China Cabinet', k: 'china', s: 'Traditional', w: 1.0, d: 0.45, h: 1.9, sp: { glazed: true } },
  { n: 'Oval Dining Table', k: 'oval', s: 'Contemporary', w: 1.8, d: 1.0, h: 0.75, sp: { legs: 4 } },
  { n: 'Bistro Round Table', k: 'round', s: 'Parisian', w: 0.8, d: 0.8, h: 0.74, sp: { base: 'pedestal' } },
  { n: 'Serving Cart', k: 'serving', s: 'Mid-Century', w: 0.9, d: 0.45, h: 0.8, sp: { wheels: 4 } },
  { n: 'Narrow Banquet Table', k: 'banquet', s: 'Classic', w: 0.8, d: 1.6, h: 0.75, sp: { legs: 4 } },
  { n: 'Wine Rack Cabinet', k: 'winerack', s: 'Cellar', w: 0.6, d: 0.4, h: 1.2, sp: { rows: 5 } },
  { n: 'Bench Dining Seat', k: 'bench', s: 'Farmhouse', w: 1.5, d: 0.4, h: 0.45, sp: { slats: 3 } },
  { n: 'Plate Rack Shelf', k: 'platerack', s: 'Cottage', w: 1.0, d: 0.28, h: 1.5, m: 'wall', sp: { shelf: true } },
  { n: 'Glass Top Table', k: 'dining', s: 'Modern', w: 1.4, d: 0.85, h: 0.75, sp: { glass: true } },
  { n: 'Bar Cart', k: 'barcart', s: 'Art Deco', w: 0.7, d: 0.45, h: 1.0, sp: { style: 'deco' } },
  { n: 'Etagere Display Shelf', k: 'etagere', s: 'Victorian', w: 0.8, d: 0.4, h: 1.8, sp: { shelves: 4 } },
  { n: 'Reclaimed Wood Table', k: 'trestle', s: 'Rustic', w: 1.6, d: 0.85, h: 0.75, sp: { base: 'trestle', reclaimed: true } },
  { n: 'Console Behind Dining', k: 'console', s: 'Classic', w: 1.2, d: 0.35, h: 0.8, sp: { doors: 0 } },
  { n: 'Corner Hutch', k: 'china', s: 'Colonial', w: 1.0, d: 0.5, h: 2.0, sp: { glazed: true, corner: true } },
  { n: 'Lazy Susan Cabinet', k: 'china', s: 'Cottage', w: 1.0, d: 1.0, h: 1.8, sp: { corner: true } },
]);

// ------------------------------------------------- nursery, kids & baby gear
// The rules for a nursery and a kids' room name things no other category held —
// a crib, a changing table, a bassinet, a mobile. A step naming one of those
// used to fall back to a plain bed or chest, so the room came out as a bedroom
// with the wrong furniture in it.
const NURSERY = build('nursery', 'floor', { c: ['#e8d9c8', '#d9e2ec', '#f0e0d0', '#cfd9e8', '#e6d5c4', '#dce8e0'], a: ['#c98a5e', '#7d9cc0', '#b08968', '#8fb3a0', '#d9a441', '#a58a9c'] }, [
  { n: 'Convertible Crib', k: 'crib', s: 'Classic', w: 1.4, d: 0.75, h: 0.95, sp: { shape: 'crib', slats: 12 } },
  { n: 'Changing Table', k: 'changing', s: 'Scandi', w: 1.0, d: 0.55, h: 0.9, sp: { shape: 'cabinet', doors: 0, drawers: 2, plinth: true } },
  { n: 'Bassinet on Wheels', k: 'bassinet', s: 'Vintage', w: 0.8, d: 0.45, h: 0.95, sp: { shape: 'crib', hood: true, wheels: true } },
  { n: 'Glider Rocking Chair', k: 'glider', s: 'Modern', w: 0.8, d: 0.9, h: 1.0, sp: { shape: 'chair', glider: true } },
  { n: 'Diaper Pail', k: 'pail', s: 'Modern', w: 0.4, d: 0.4, h: 0.6, sp: { shape: 'jar', lid: true } },
  { n: 'Bunk Bed', k: 'bunk', s: 'Classic', w: 2.0, d: 1.0, h: 1.7, sp: { shape: 'bunk' } },
  { n: 'Crib Mobile', k: 'mobile', s: 'Dreamy', w: 0.5, d: 0.5, h: 0.4, m: 'ceiling', sp: { shape: 'drop', arms: 4, drops: true } },
  { n: 'Baby Monitor', k: 'monitor', s: 'Modern', w: 0.16, d: 0.1, h: 0.2, m: 'surface', sp: { shape: 'small', screen: true } },
  { n: 'Sound Machine', k: 'soundmachine', s: 'Modern', w: 0.16, d: 0.16, h: 0.18, m: 'surface', sp: { shape: 'jar', knobs: true } },
  { n: 'Nightlight Plug', k: 'nightlight', s: 'Plain', w: 0.08, d: 0.05, h: 0.1, m: 'wall', sp: { shape: 'wallflat', bulbs: true } },
  { n: 'Soft Toy Basket', k: 'toybasket', s: 'Playful', w: 0.5, d: 0.4, h: 0.35, sp: { shape: 'bin', soft: true } },
  { n: 'Star Projector', k: 'starprojector', s: 'Dreamy', w: 0.16, d: 0.16, h: 0.16, m: 'wall', sp: { shape: 'wallflat', dome: true } },
  { n: 'Glow Star Decals', k: 'glowstar', s: 'Playful', w: 0.9, d: 0.05, h: 0.6, m: 'wall', sp: { shape: 'wallflat', stars: 7 } },
  { n: 'Hanging Canopy', k: 'canopy', s: 'Dreamy', w: 1.6, d: 1.6, h: 1.9, m: 'ceiling', sp: { shape: 'drop', canopy: true } },
  { n: 'Bunting Garland', k: 'bunting', s: 'Playful', w: 1.8, d: 0.04, h: 0.3, m: 'wall', sp: { shape: 'wallflat', flags: 9 } },
  { n: 'Moses Basket', k: 'moses', s: 'Vintage', w: 0.7, d: 0.4, h: 0.3, sp: { shape: 'bin', woven: true } },
  { n: 'Toy Bin Trolley', k: 'toybin', s: 'Playful', w: 0.7, d: 0.35, h: 0.6, sp: { shape: 'cabinet', doors: 0, drawers: 2, wheels: true, open: true } },
  { n: 'Book Light', k: 'booklight', s: 'Classic', w: 0.12, d: 0.12, h: 0.14, m: 'wall', sp: { shape: 'wallflat', arm: true } },
  { n: 'Changing Mat', k: 'pad', s: 'Plain', w: 0.8, d: 0.5, h: 0.06, m: 'surface', sp: { shape: 'mat', pad: true } },
  { n: 'Rocking Horse', k: 'horse', s: 'Vintage', w: 0.9, d: 0.35, h: 0.8, sp: { shape: 'horse' } },
]);

// ------------------------------------------------------------- home gym gear
// Every item the rules name for a home gym was absent, so a gym used to fill
// with media consoles and benches. This is the actual equipment.
const GYM = build('gym', 'floor', { c: ['#2f3646', '#3d405b', '#4b5563', '#5b6573', '#1f2933', '#6e7681'], a: ['#c46a4a', '#d9a441', '#5f8f7f', '#8d99ae', '#a26769', '#2f6f5e'] }, [
  { n: 'Treadmill', k: 'treadmill', s: 'Modern', w: 0.9, d: 2.0, h: 1.3, sp: { shape: 'machine', belt: true } },
  { n: 'Spin Bike', k: 'bike', s: 'Studio', w: 0.6, d: 1.2, h: 1.2, sp: { shape: 'machine', flywheel: true } },
  { n: 'Rowing Machine', k: 'rower', s: 'Studio', w: 0.6, d: 2.2, h: 0.8, sp: { shape: 'machine', rail: true } },
  { n: 'Squat Rack', k: 'squatrack', s: 'Commercial', w: 1.4, d: 1.2, h: 2.2, sp: { shape: 'rack', bars: 1 } },
  { n: 'Weight Bench', k: 'weightbench', s: 'Commercial', w: 0.6, d: 1.3, h: 0.5, sp: { shape: 'bench', pad: true } },
  { n: 'Dumbbell Rack', k: 'dumbbellrack', s: 'Commercial', w: 1.2, d: 0.4, h: 0.6, sp: { shape: 'tiers', pairs: 4 } },
  { n: 'Kettlebell Set', k: 'kettlebell', s: 'Commercial', w: 0.8, d: 0.4, h: 0.45, sp: { shape: 'bellrow', bells: 4 } },
  { n: 'Medicine Ball', k: 'medball', s: 'Studio', w: 0.3, d: 0.3, h: 0.3, sp: { shape: 'jar', ball: true } },
  { n: 'Punching Bag', k: 'punchingbag', s: 'Boxing', w: 0.4, d: 0.4, h: 1.9, sp: { shape: 'post', bag: true } },
  { n: 'Pull-up Bar', k: 'pullup', s: 'Studio', w: 1.2, d: 0.15, h: 0.25, m: 'wall', sp: { shape: 'rod', brackets: 2 } },
  { n: 'Cable Machine', k: 'cablemachine', s: 'Commercial', w: 0.8, d: 0.6, h: 2.2, sp: { shape: 'rack', stack: 4 } },
  { n: 'Weight Plate Tree', k: 'platetree', s: 'Commercial', w: 0.5, d: 0.5, h: 1.2, sp: { shape: 'post', plates: true } },
  { n: 'Yoga Mat', k: 'yogamat', s: 'Plain', w: 0.7, d: 1.8, h: 0.03, sp: { shape: 'mat', rolled: true } },
  { n: 'Foam Roller', k: 'foamroller', s: 'Studio', w: 0.2, d: 0.6, h: 0.2, sp: { shape: 'jar', roller: true } },
  { n: 'Step Platform', k: 'step', s: 'Studio', w: 0.8, d: 0.5, h: 0.3, sp: { shape: 'step', tiers: 2 } },
  { n: 'Ab Wheel', k: 'abwheel', s: 'Studio', w: 0.35, d: 0.3, h: 0.35, sp: { shape: 'rack', ring: true } },
  { n: 'Jump Rope', k: 'jumprope', s: 'Studio', w: 0.2, d: 0.2, h: 0.05, m: 'surface', sp: { shape: 'small', coil: true } },
  { n: 'Resistance Bands', k: 'bands', s: 'Studio', w: 0.22, d: 0.22, h: 0.06, m: 'surface', sp: { shape: 'small', loops: true } },
  { n: 'Water Bottle Station', k: 'bottlestation', s: 'Modern', w: 0.6, d: 0.35, h: 1.1, sp: { shape: 'cabinet', doors: 0, tiers: 2, bottles: true } },
  { n: 'Sound System Speaker', k: 'soundsystem', s: 'Studio', w: 0.4, d: 0.35, h: 0.8, sp: { shape: 'trunk', cones: true } },
]);

// ------------------------------------------------------- laundry & utility
// Washer, dryer, hanging rod, drying rack, ironing board, clothespins. None of
// these existed, so a laundry room filled with kitchen cabinets instead.
const LAUNDRY = build('laundry', 'floor', { c: ['#e0dcd5', '#d9d2c5', '#ece7dd', '#c9d2d9', '#e8e3d9', '#d4dde2'], a: ['#4b5563', '#5b6573', '#8a8f99', '#3d405b', '#6e7681', '#2f3e46'] }, [
  { n: 'Front Load Washer', k: 'washer', s: 'Modern', w: 0.6, d: 0.6, h: 0.85, sp: { shape: 'appliance', door: true } },
  { n: 'Front Load Dryer', k: 'dryer', s: 'Modern', w: 0.6, d: 0.6, h: 0.85, sp: { shape: 'appliance', door: true, vent: true } },
  { n: 'Stacked Washer Dryer', k: 'stackpair', s: 'Modern', w: 0.6, d: 0.6, h: 1.7, sp: { shape: 'appliance', door: true, stack: 2 } },
  { n: 'Folding Counter', k: 'foldcounter', s: 'Utility', w: 1.2, d: 0.6, h: 0.9, sp: { shape: 'cabinet', doors: 0, plinth: true, top: true } },
  { n: 'Utility Sink', k: 'utilsink', s: 'Utility', w: 0.6, d: 0.55, h: 0.9, sp: { shape: 'cabinet', doors: 2, basin: true } },
  { n: 'Laundry Base Cabinet', k: 'laundrycab', s: 'Shaker', w: 0.9, d: 0.6, h: 0.88, sp: { shape: 'cabinet', doors: 2, plinth: true } },
  { n: 'Laundry Wall Cabinet', k: 'laundrywall', s: 'Shaker', w: 0.9, d: 0.35, h: 1.5, m: 'wall', sp: { shape: 'cabinet', doors: 2 } },
  { n: 'Hanging Rod', k: 'rod', s: 'Utility', w: 1.2, d: 0.4, h: 1.7, sp: { shape: 'rod', brackets: 2, hanging: true } },
  { n: 'Drying Rack', k: 'dryingrack', s: 'Utility', w: 1.0, d: 0.6, h: 1.1, sp: { shape: 'rack', bars: 7 } },
  { n: 'Ironing Board', k: 'ironingboard', s: 'Utility', w: 1.3, d: 0.4, h: 0.9, sp: { shape: 'boardiron', legs: true } },
  { n: 'Iron Rest', k: 'iron', s: 'Utility', w: 0.2, d: 0.3, h: 0.3, m: 'surface', sp: { shape: 'small', wedge: true } },
  { n: 'Clothespin Jar', k: 'clothespin', s: 'Cottage', w: 0.14, d: 0.14, h: 0.2, m: 'surface', sp: { shape: 'jar', pegs: true } },
  { n: 'Detergent Jar Set', k: 'detergent', s: 'Plain', w: 0.34, d: 0.18, h: 0.3, m: 'surface', sp: { shape: 'jarset', jars: 3 } },
  { n: 'Sorting Hamper', k: 'hamper', s: 'Utility', w: 0.55, d: 0.5, h: 0.75, sp: { shape: 'bin', canvas: true, bands: 2 } },
  { n: 'Lint Bin', k: 'lintbin', s: 'Utility', w: 0.24, d: 0.24, h: 0.3, sp: { shape: 'jar', vent: true } },
  { n: 'Utility Shelf', k: 'utilityshelf', s: 'Utility', w: 1.0, d: 0.35, h: 1.8, sp: { shape: 'shelf', shelves: 4, uprights: 2 } },
  { n: 'Wall Hook Rail', k: 'hookrail', s: 'Utility', w: 0.9, d: 0.06, h: 0.2, m: 'wall', sp: { shape: 'wallflat', hooks: 4 } },
  { n: 'Laundry Trolley', k: 'trolley', s: 'Utility', w: 0.7, d: 0.5, h: 0.9, sp: { shape: 'cabinet', doors: 0, drawers: 1, wheels: true } },
  { n: 'Ironing Board Cover', k: 'boardcover', s: 'Plain', w: 0.3, d: 0.2, h: 0.08, m: 'surface', sp: { shape: 'small', folded: true } },
  { n: 'Laundry Floor Mat', k: 'laundrymat', s: 'Plain', w: 0.8, d: 0.5, h: 0.02, m: 'surface', sp: { shape: 'mat' } },
]);

// ------------------------------------------------------ office, study & desk
// Filing cabinets, monitors, keyboards, footrests, cable trays, globes, busts
// and reading-glasses stands. The study and library rules name several of
// these too.
const OFFICE = build('office', 'floor', { c: [...WOOD, ...METAL, ...LIGHT], a: [...WOOD_DARK, ...BRASS, ...FABRIC_DARK] }, [
  { n: 'Executive Desk', k: 'desk', s: 'Classic', w: 1.6, d: 0.8, h: 0.75, sp: { shape: 'trunk', drawers: 3, leather: true } },
  { n: 'Ergonomic Task Chair', k: 'taskchair', s: 'Studio', w: 0.65, d: 0.65, h: 1.15, sp: { shape: 'chair', wheels: true, tall: true } },
  { n: 'Filing Cabinet', k: 'filing', s: 'Modern', w: 0.45, d: 0.6, h: 1.3, sp: { shape: 'cabinet', drawers: 4 } },
  { n: 'Standing Desk Converter', k: 'standing', s: 'Studio', w: 1.2, d: 0.6, h: 1.1, sp: { shape: 'trunk', riser: true } },
  { n: 'Monitor', k: 'monitor', s: 'Modern', w: 0.6, d: 0.2, h: 0.45, m: 'surface', sp: { shape: 'small', screen: true, stand: true } },
  { n: 'Keyboard', k: 'keyboard', s: 'Modern', w: 0.44, d: 0.15, h: 0.03, m: 'surface', sp: { shape: 'small', keys: true } },
  { n: 'Mouse', k: 'mouse', s: 'Modern', w: 0.07, d: 0.11, h: 0.04, m: 'surface', sp: { shape: 'small', dome: true } },
  { n: 'Footrest', k: 'footrest', s: 'Studio', w: 0.45, d: 0.35, h: 0.12, m: 'surface', sp: { shape: 'step', tilted: true } },
  { n: 'Cable Tray', k: 'cabletray', s: 'Studio', w: 0.6, d: 0.12, h: 0.08, m: 'surface', sp: { shape: 'small', tray: true } },
  { n: 'Desk Organiser', k: 'organiser', s: 'Classic', w: 0.3, d: 0.2, h: 0.16, m: 'surface', sp: { shape: 'small', compartments: true } },
  { n: 'Wastebasket', k: 'wastebasket', s: 'Studio', w: 0.3, d: 0.3, h: 0.4, sp: { shape: 'jar', open: true } },
  { n: 'Printer', k: 'printer', s: 'Modern', w: 0.45, d: 0.4, h: 0.28, m: 'surface', sp: { shape: 'trunk', tray: true } },
  { n: 'Document Tray', k: 'doctray', s: 'Modern', w: 0.32, d: 0.25, h: 0.3, m: 'surface', sp: { shape: 'small', stack: 3 } },
  { n: 'Whiteboard', k: 'whiteboard', s: 'Studio', w: 1.2, d: 0.05, h: 0.9, m: 'wall', sp: { shape: 'wallflat', frame: true } },
  { n: 'Desk Globe', k: 'globe', s: 'Classic', w: 0.3, d: 0.3, h: 0.42, m: 'surface', sp: { shape: 'small', globe: true } },
  { n: 'Reading Glasses Stand', k: 'glassesstand', s: 'Classic', w: 0.14, d: 0.1, h: 0.14, m: 'surface', sp: { shape: 'small', post: true } },
  { n: 'Classical Bust', k: 'bust', s: 'Classical', w: 0.28, d: 0.24, h: 0.5, m: 'surface', sp: { shape: 'bust' } },
  { n: 'Rolling Library Ladder', k: 'rollingladder', s: 'Library', w: 0.5, d: 0.3, h: 2.2, sp: { shape: 'ladder', rails: 2 } },
  { n: 'Decorative Tissue Box', k: 'tissue', s: 'Classic', w: 0.24, d: 0.12, h: 0.12, m: 'surface', sp: { shape: 'small', tray: true, wide: true, tissue: true } },
  { n: 'Pin Board', k: 'pinboard', s: 'Studio', w: 0.9, d: 0.05, h: 0.6, m: 'wall', sp: { shape: 'wallflat', notes: true } },
]);

// ------------------------------------------------- pantry & kitchen sundries
// Can organizers, labels, a chalkboard inventory list, utensil crocks and
// cutting boards — the kitchen and pantry rules name all of these.
const PANTRY = build('pantry', 'floor', { c: [...WOOD, ...CERAMIC, ...LIGHT], a: [...WOOD_DARK, ...BRASS, ...METAL] }, [
  { n: 'Adjustable Pantry Shelving', k: 'pantryshelf', s: 'Utility', w: 1.0, d: 0.4, h: 2.0, sp: { shape: 'shelf', shelves: 5, uprights: 4, holes: true } },
  { n: 'Freestanding Pantry Cabinet', k: 'pantrycab', s: 'Shaker', w: 0.9, d: 0.45, h: 1.9, sp: { shape: 'cabinet', doors: 2, plinth: true } },
  { n: 'Pantry Rolling Cart', k: 'pantrycart', s: 'Cottage', w: 0.7, d: 0.4, h: 0.85, sp: { shape: 'cabinet', doors: 0, drawers: 3, wheels: true } },
  { n: 'Wine Rack', k: 'pantrywine', s: 'Cellar', w: 0.6, d: 0.35, h: 1.1, sp: { shape: 'shelf', shelves: 4, bottles: true } },
  { n: 'Step Stool', k: 'stepstool', s: 'Plain', w: 0.4, d: 0.35, h: 0.45, sp: { shape: 'step', tiers: 2, wooden: true } },
  { n: 'Clear Storage Bin', k: 'clearbin', s: 'Plain', w: 0.32, d: 0.24, h: 0.2, m: 'surface', sp: { shape: 'small', clear: true } },
  { n: 'Can Organizer', k: 'canorg', s: 'Utility', w: 0.36, d: 0.26, h: 0.42, m: 'surface', sp: { shape: 'rack', cans: 6, shallow: true } },
  { n: 'Lazy Susan', k: 'lazysusan', s: 'Utility', w: 0.35, d: 0.35, h: 0.1, m: 'surface', sp: { shape: 'jar', disc: true, handles: true } },
  { n: 'Jar Labels', k: 'jarlabels', s: 'Plain', w: 0.16, d: 0.16, h: 0.05, m: 'surface', sp: { shape: 'small', sheet: true } },
  { n: 'Inventory Chalkboard', k: 'chalkboard', s: 'Cottage', w: 0.8, d: 0.04, h: 1.0, m: 'wall', sp: { shape: 'wallflat', chalk: true, frame: true } },
  { n: 'Backsplash Tile Panel', k: 'backsplash', s: 'Plain', w: 1.2, d: 0.03, h: 0.5, m: 'wall', sp: { shape: 'wallflat', tiles: true } },
  { n: 'Spice Rack', k: 'spicerack', s: 'Plain', w: 0.3, d: 0.12, h: 0.34, m: 'surface', sp: { shape: 'shelf', shelves: 2, jars: true } },
  { n: 'Bread Box', k: 'breadbox', s: 'Cottage', w: 0.4, d: 0.25, h: 0.22, m: 'surface', sp: { shape: 'trunk', lid: true } },
  { n: 'Egg Shelf', k: 'eggshelf', s: 'Cottage', w: 0.3, d: 0.22, h: 0.18, m: 'surface', sp: { shape: 'small', eggs: true } },
  { n: 'Pantry Pull-out Drawer', k: 'pantrydrawer', s: 'Utility', w: 0.6, d: 0.5, h: 0.3, sp: { shape: 'cabinet', doors: 0, drawers: 1, open: true } },
  { n: 'Storage Crate', k: 'crate', s: 'Rustic', w: 0.45, d: 0.35, h: 0.3, sp: { shape: 'bin', slats: true } },
  { n: 'Apothecary Jar', k: 'apothecary', s: 'Vintage', w: 0.16, d: 0.16, h: 0.28, m: 'surface', sp: { shape: 'jar', lid: true } },
  { n: 'Utensil Crock', k: 'crock', s: 'Cottage', w: 0.16, d: 0.16, h: 0.26, m: 'surface', sp: { shape: 'jar', utensils: true } },
  { n: 'Cutting Board', k: 'board', s: 'Farmhouse', w: 0.42, d: 0.28, h: 0.03, m: 'surface', sp: { shape: 'small', board: true } },
  { n: 'Apron Hook Rail', k: 'apronhook', s: 'Cottage', w: 0.8, d: 0.06, h: 0.18, m: 'wall', sp: { shape: 'wallflat', hooks: 3 } },
]);

// -------------------------------------------------- outdoor & sunroom pieces
// A porch swing, wind chimes, lanterns and a bird feeder: the sunroom rules
// name all four and none of them existed.
const OUTDOOR = build('outdoor', 'floor', { c: ['#b08968', '#c9a97a', '#8a6b45', '#a3b18a', '#d8c3a5', '#9c7f5e'], a: ['#4f7a4a', '#3f6b3f', '#5f8f5a', '#2f6f5e', '#7aa05f', '#8d99ae'] }, [
  { n: 'Porch Swing', k: 'porchswing', s: 'Rustic', w: 1.6, d: 0.8, h: 2.0, sp: { shape: 'swing', chains: true } },
  { n: 'Rattan Sofa', k: 'rattansofa', s: 'Coastal', w: 1.9, d: 0.85, h: 0.85, sp: { shape: 'sofa', wicker: true } },
  { n: 'Rattan Lounge Chair', k: 'rattanchair', s: 'Coastal', w: 0.8, d: 0.85, h: 0.85, sp: { shape: 'chair', wicker: true } },
  { n: 'Wicker Side Table', k: 'wickertable', s: 'Coastal', w: 0.5, d: 0.5, h: 0.5, sp: { shape: 'trunk', round: true, wicker: true } },
  { n: 'Wind Chimes', k: 'chimes', s: 'Plain', w: 0.2, d: 0.2, h: 0.5, m: 'ceiling', sp: { shape: 'drop', tubes: 5 } },
  { n: 'Bird Feeder', k: 'feeder', s: 'Rustic', w: 0.3, d: 0.3, h: 0.4, sp: { shape: 'post', roof: true } },
  { n: 'Paper Lantern', k: 'lantern', s: 'Plain', w: 0.3, d: 0.3, h: 0.45, m: 'ceiling', sp: { shape: 'drop', globe: true, lit: true } },
  { n: 'Outdoor Area Rug', k: 'outdoorrug', s: 'Coastal', w: 2.0, d: 1.4, h: 0.02, sp: { shape: 'mat', stripes: true } },
  { n: 'Parasol', k: 'parasol', s: 'Coastal', w: 2.0, d: 2.0, h: 2.2, sp: { shape: 'post', canopy: true } },
  { n: 'Bistro Set', k: 'bistro', s: 'Parisian', w: 0.7, d: 0.7, h: 0.75, sp: { shape: 'trunk', round: true, bistro: true } },
  { n: 'Garden Stool', k: 'gardenstool', s: 'Rustic', w: 0.4, d: 0.4, h: 0.45, sp: { shape: 'step', tiers: 1, wooden: true } },
  { n: 'Doormat', k: 'doormat', s: 'Plain', w: 0.8, d: 0.5, h: 0.02, sp: { shape: 'mat', coir: true } },
  { n: 'Planter Box', k: 'planter', s: 'Rustic', w: 0.8, d: 0.4, h: 0.45, sp: { shape: 'bin', slats: true, plants: true } },
  { n: 'Trellis', k: 'trellis', s: 'Rustic', w: 1.0, d: 0.06, h: 1.8, m: 'wall', sp: { shape: 'wallflat', slats: true } },
  { n: 'Watering Can', k: 'wateringcan', s: 'Rustic', w: 0.3, d: 0.18, h: 0.35, sp: { shape: 'jar', spout: true } },
  { n: 'Hose Reel', k: 'hosereel', s: 'Utility', w: 0.5, d: 0.25, h: 0.5, m: 'wall', sp: { shape: 'wallflat', drum: true } },
  { n: 'Outdoor Bench', k: 'outdoorbench', s: 'Rustic', w: 1.6, d: 0.45, h: 0.45, sp: { shape: 'bench', slats: true } },
  { n: 'Mailbox', k: 'mailbox', s: 'Plain', w: 0.22, d: 0.3, h: 0.25, m: 'wall', sp: { shape: 'wallflat', boxy: true } },
  { n: 'Fire Pit', k: 'firepit', s: 'Rustic', w: 0.8, d: 0.8, h: 0.35, sp: { shape: 'jar', bowl: true } },
  { n: 'Outdoor Side Table', k: 'outdoorside', s: 'Coastal', w: 0.45, d: 0.45, h: 0.55, sp: { shape: 'trunk', round: true, slats: true } },
]);

// ------------------------------------------------ closet & dressing storage
// Hanging rods, valet stands, velvet hangers, drawer dividers and luggage
// racks — named by the walk-in closet and guest room rules.
const CLOSET = build('closet', 'floor', { c: [...WOOD, ...METAL, ...LIGHT], a: [...WOOD_DARK, ...BRASS, ...FABRIC_DARK] }, [
  { n: 'Custom Closet Shelving', k: 'closetshelf', s: 'Contemporary', w: 1.2, d: 0.6, h: 2.2, sp: { shape: 'shelf', shelves: 4, uprights: 2, hanging: true } },
  { n: 'Double Hanging Rod', k: 'rod2', s: 'Contemporary', w: 1.2, d: 0.6, h: 2.0, sp: { shape: 'rod', brackets: 2, hanging: true, tiers: 2 } },
  { n: 'Valet Stand', k: 'valet', s: 'Classic', w: 0.5, d: 0.5, h: 1.8, sp: { shape: 'post', arms: 3 } },
  { n: 'Velvet Hanger', k: 'hanger', s: 'Classic', w: 0.42, d: 0.1, h: 0.12, m: 'surface', sp: { shape: 'small', hanger: true } },
  { n: 'Drawer Divider', k: 'divider', s: 'Plain', w: 0.4, d: 0.3, h: 0.06, m: 'surface', sp: { shape: 'small', grid: true } },
  { n: 'Tiered Shoe Rack', k: 'shoerack', s: 'Metal', w: 0.7, d: 0.3, h: 0.8, sp: { shape: 'tiers', pairs: 4, shoes: true } },
  { n: 'Closet Drawer Unit', k: 'closetdrawer', s: 'Contemporary', w: 0.8, d: 0.55, h: 0.9, sp: { shape: 'cabinet', drawers: 5 } },
  { n: 'Closet Island', k: 'closetisland', s: 'Luxury', w: 1.2, d: 0.8, h: 0.9, sp: { shape: 'cabinet', doors: 0, drawers: 2, glass: true, top: true } },
  { n: 'Full-length Mirror', k: 'fullmirror', s: 'Classic', w: 0.5, d: 0.05, h: 1.7, m: 'wall', sp: { shape: 'wallflat', mirror: true, tall: true } },
  { n: 'Closet Light Strip', k: 'closetlight', s: 'Modern', w: 1.0, d: 0.05, h: 0.06, m: 'wall', sp: { shape: 'wallflat', strip: true, lit: true } },
  { n: 'Jewellery Organiser', k: 'jewelorganiser', s: 'Luxury', w: 0.28, d: 0.2, h: 0.12, m: 'surface', sp: { shape: 'small', compartments: true, velvet: true } },
  { n: 'Cedar Hanger', k: 'cedar', s: 'Classic', w: 0.42, d: 0.12, h: 0.14, m: 'surface', sp: { shape: 'small', hanger: true, shaped: true } },
  { n: 'Closet Bench', k: 'closetbench', s: 'Upholstered', w: 1.1, d: 0.45, h: 0.48, sp: { shape: 'bench', pad: true, buttoned: true } },
  { n: 'Perfume Tray', k: 'perftray', s: 'Luxury', w: 0.3, d: 0.2, h: 0.04, m: 'surface', sp: { shape: 'small', tray: true, bottles: true } },
  { n: 'Belt & Scarf Hook', k: 'belt', s: 'Classic', w: 0.3, d: 0.06, h: 0.12, m: 'wall', sp: { shape: 'wallflat', hooks: 3 } },
  { n: 'Luggage Rack', k: 'luggage', s: 'Classic', w: 0.6, d: 0.45, h: 0.5, sp: { shape: 'rack', bars: 5, xframe: true } },
  { n: 'Hat Shelf', k: 'hatshelf', s: 'Classic', w: 0.8, d: 0.25, h: 1.6, sp: { shape: 'shelf', shelves: 3, hats: true } },
  { n: 'Closet Basket', k: 'basketbin', s: 'Cottage', w: 0.4, d: 0.35, h: 0.3, sp: { shape: 'bin', canvas: true } },
  { n: 'Hanger Bar', k: 'hangerbar', s: 'Metal', w: 0.8, d: 0.08, h: 0.08, m: 'wall', sp: { shape: 'rod', brackets: 2 } },
  { n: 'Hook Rail', k: 'closethook', s: 'Metal', w: 0.7, d: 0.06, h: 0.16, m: 'wall', sp: { shape: 'wallflat', hooks: 5 } },
]);

export const LIBRARY: FurnItem[] = [
  ...SEATING, ...TABLES, ...STORAGE, ...BEDS,
  ...CEILING, ...WALLLIGHT, ...LAMPS, ...ARCH,
  ...FLOORPLANTS, ...TABLEPLANTS, ...SUCCULENTS, ...HANGING, ...TREES,
  ...TEXTILES, ...WALLDECOR, ...TABLETOP, ...FUNCTIONAL,
  ...KITCHEN, ...DINING,
  ...VANITY, ...BATHTUB, ...SHOWER, ...TOILET, ...TOWELRACK, ...VAMIRROR,
  ...NURSERY, ...GYM, ...LAUNDRY, ...OFFICE, ...PANTRY, ...OUTDOOR, ...CLOSET,
];

export const ITEM_INDEX: Map<string, FurnItem> = new Map(LIBRARY.map((i) => [i.id, i]));

export function itemsOf(type: FurnType): FurnItem[] {
  return LIBRARY.filter((i) => i.type === type);
}
