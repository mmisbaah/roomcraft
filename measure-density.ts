/**
 * What the user is looking at, measured.
 *
 *  1. more than two items of the same category in a room
 *  2. items too close together
 *  3. too many decorative items
 *  4. how far apart the lights of every kind actually are
 */
import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { isFlat } from './src/logic/placement';
import type { FurnItem, PlacedItem, RoomKind, Vec2 } from './src/types';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));

const LIGHT_TYPES = new Set(['ceilight', 'walllight', 'floorlamp']);
/** Decor: the categories that are there to look at rather than to be used. */
const DECOR_TYPES = new Set(['walldecor', 'textiles', 'plant']);

function fill(kind: RoomKind, w: number, h: number) {
  S().clearRoom();
  S().askRoom(null);
  S().setMode('draw');
  S().setTier('max');
  S().addRoom([
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]);
  const room = S().rooms[0];
  S().describeRoom(room.id, { name: '', kind, note: '' });
  S().clearItems();
  S().aiFill();
  return {
    items: S().items.filter((i) => i.roomId === room.id),
    poly: S().rooms[0].poly as Vec2[],
  };
}

const half = (it: PlacedItem, f: FurnItem) => {
  const r = (it.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { x: (f.w * c + f.d * s) / 2, y: (f.w * s + f.d * c) / 2 };
};

/** Edge-to-edge distance between two footprints; negative means overlapping. */
function gap(a: PlacedItem, fa: FurnItem, b: PlacedItem, fb: FurnItem): number {
  const ha = half(a, fa);
  const hb = half(b, fb);
  // Per axis: positive is overlap, negative is clearance.
  const ox = ha.x + hb.x - Math.abs(a.x - b.x);
  const oy = ha.y + hb.y - Math.abs(a.y - b.y);
  if (ox > 0 && oy > 0) return -Math.min(ox, oy);
  return Math.hypot(Math.max(0, -ox), Math.max(0, -oy));
}

for (const [kind, w, h] of [
  ['living', 5.5, 4.75],
  ['kitchen', 4.5, 3.5],
  ['bedroom', 5, 4.5],
] as [RoomKind, number, number][]) {
  const r = fill(kind, w, h);
  const defs = r.items.map((i) => BY.get(i.itemId)!);

  console.log(`\n=== ${kind} ${w}x${h} (${(w * h).toFixed(1)} m2) — ${r.items.length} items`);

  // 1. items per category
  const perType = new Map<string, number>();
  for (const d of defs) perType.set(d.type, (perType.get(d.type) ?? 0) + 1);
  const crowded = [...perType.entries()].filter(([, n]) => n > 2).sort((a, b) => b[1] - a[1]);
  console.log('  categories with more than two items:');
  for (const [t, n] of crowded) console.log(`    ${t.padEnd(12)} ${n}`);

  // 2. closest pairs — floor items only. Wall items are meant to sit near each
  // other on a wall (a gallery wall is a design), so they are counted apart.
  const floorIdx = r.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ idx }) => defs[idx].mount === 'floor' && !isFlat(defs[idx]))
    .map(({ idx }) => idx);
  const pairs: { g: number; a: string; b: string }[] = [];
  for (let x = 0; x < floorIdx.length; x++) {
    for (let y = x + 1; y < floorIdx.length; y++) {
      const i = floorIdx[x];
      const j = floorIdx[y];
      const g = gap(r.items[i], defs[i], r.items[j], defs[j]);
      if (g < 0.35) pairs.push({ g, a: defs[i].name, b: defs[j].name });
    }
  }
  pairs.sort((a, b) => a.g - b.g);
  console.log(`  floor pairs closer than 35 cm: ${pairs.length}`);
  for (const p of pairs.slice(0, 8)) {
    console.log(`    ${p.g.toFixed(2)} m  ${p.a}  vs  ${p.b}`);
  }

  // 3. decor
  const decor = defs.filter((d) => DECOR_TYPES.has(d.type));
  console.log(`  decor items: ${decor.length}  (${decor.map((d) => d.type).join(', ')})`);

  // 4. light spacing across every kind
  const lights = r.items.filter((i) => LIGHT_TYPES.has(BY.get(i.itemId)!.type));
  let tight = Infinity;
  let tightPair = '';
  for (let i = 0; i < lights.length; i++) {
    for (let j = i + 1; j < lights.length; j++) {
      const d = Math.hypot(lights[i].x - lights[j].x, lights[i].y - lights[j].y);
      if (d < tight) {
        tight = d;
        tightPair = `${BY.get(lights[i].itemId)!.name} vs ${BY.get(lights[j].itemId)!.name}`;
      }
    }
  }
  console.log(`  lights: ${lights.length}  closest ${lights.length < 2 ? 'n/a' : `${tight.toFixed(2)} m (${tightPair})`}`);
}

S().clearRoom();