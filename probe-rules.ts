/**
 * Audit the three new surface/wall rules:
 *  1. nothing standing on seating (pillows/throws exempt),
 *  2. storage, kitchen and closet pieces hug the wall,
 *  3. at most one surface item per piece of furniture.
 */
import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { WALL_FURNITURE_TYPES, WALL_FURNITURE_GAP } from './src/logic/placement';
import { distPointSeg } from './src/logic/geometry';
import type { FurnItem, PlacedItem, RoomKind, Vec2 } from './src/types';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));
const KINDS: RoomKind[] = [
  'living', 'dining', 'kitchen', 'bedroom', 'kids', 'nursery', 'office', 'study',
  'library', 'guest', 'bathroom', 'laundry', 'entryway', 'hallway', 'gym',
  'sunroom', 'pantry', 'closet',
];
const SIZES: [number, number][] = [[5.5, 4.75], [4.5, 3.5], [3.5, 3]];

function fill(kind: RoomKind, w: number, h: number) {
  S().clearRoom();
  S().askRoom(null);
  S().setMode('draw');
  S().setTier('max');
  S().addRoom([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
  const room = S().rooms[0];
  S().describeRoom(room.id, { name: '', kind, note: '' });
  S().clearItems();
  S().aiFill();
  return { items: S().items.filter((i) => i.roomId === room.id), poly: S().rooms[0].poly };
}

const isPillow = (f: FurnItem) => f.kind === 'pillow' || f.spec?.pillow === true;

function gapToPoly(poly: Vec2[], x: number, y: number, w: number, d: number): number {
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

const hostOf = (it: PlacedItem, items: PlacedItem[]) => {
  for (const o of items) {
    if (o.uid === it.uid) continue;
    const of = BY.get(o.itemId)!;
    if (of.mount !== 'floor' || of.type === 'textiles') continue;
    if (Math.abs(it.x - o.x) <= of.w / 2 + 0.03 && Math.abs(it.y - o.y) <= of.d / 2 + 0.03) {
      return o;
    }
  }
  return null;
};

let fills = 0;
let onSeating = 0;
let midWall = 0;
let stacked = 0;
const samples: string[] = [];

for (let run = 0; run < 2; run++) {
  for (const kind of KINDS) {
    for (const [w, h] of SIZES) {
      const { items, poly } = fill(kind, w, h);
      fills++;

      // Rule 1 — nothing stands on seating at all.
      for (const it of items) {
        const f = BY.get(it.itemId)!;
        if (f.mount !== 'surface') continue;
        const host = hostOf(it, items);
        if (host && BY.get(host.itemId)!.type === 'seating') {
          onSeating++;
          if (samples.length < 6) samples.push(`${kind} ${w}x${h}: ${f.kind} on ${BY.get(host.itemId)!.kind}`);
        }
      }

      // Rule 2 — casegoods hug the wall.
      for (const it of items) {
        const f = BY.get(it.itemId)!;
        if (f.mount !== 'floor' || !WALL_FURNITURE_TYPES.has(f.type)) continue;
        const r = it.rot % 180;
        const fw = r ? f.d : f.w;
        const fd = r ? f.w : f.d;
        const g = gapToPoly(poly, it.x, it.y, fw, fd);
        if (g > WALL_FURNITURE_GAP + 0.05) {
          midWall++;
          if (samples.length < 6) samples.push(`${kind} ${w}x${h}: ${f.kind} ${g.toFixed(2)} m off`);
        }
      }

      // Rule 3 — one surface item per piece of furniture.
      const count = new Map<string, { items: string[]; host: string }>();
      for (const it of items) {
        const f = BY.get(it.itemId)!;
        if (f.mount !== 'surface') continue;
        const host = hostOf(it, items);
        if (!host) continue;
        const h = BY.get(host.itemId)!;
        const e = count.get(host.uid) ?? { items: [], host: `${h.type}:${h.kind}` };
        e.items.push(f.kind);
        count.set(host.uid, e);
      }
      for (const e of count.values()) {
        if (e.items.length > 1) {
          stacked++;
          if (samples.length < 6) samples.push(`${kind} ${w}x${h}: ${e.items.join(',')} on ${e.host}`);
        }
      }
    }
  }
}

console.log(`fills: ${fills}`);
console.log(`on seating (bad):      ${onSeating}`);
console.log(`casegoods off wall:    ${midWall}`);
console.log(`stacked surface items: ${stacked}`);
for (const s of samples) console.log('  ', s);
S().clearRoom();
