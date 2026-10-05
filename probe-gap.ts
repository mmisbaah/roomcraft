/**
 * Acceptance audit for the density rules: over many fills, how often does a
 * non-exempt pair end up closer than MIN_FLOOR_GAP, and — the key question —
 * is that because the pass could not fix it or because it never tried?
 *
 * Each room is measured twice: as AI Fill left it, and again after running the
 * separation pass once more by hand. If the second number drops, the pass is
 * giving up too early; if it does not, the room is simply too full and the
 * fix has to happen at what gets chosen, not at where it lands.
 */
import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { resolveOverlaps } from './src/logic/roomrules';
import {
  gapAllowed,
  MIN_FLOOR_GAP,
  isFlat,
  isChair,
  CATEGORY_LIMIT,
  DECOR_LIMIT,
  DECOR_TYPES,
  REPEAT_EXEMPT,
  CEILING_LIGHT_SPACING,
  DUPLICATE_FREE_AREA_MAX,
} from './src/logic/placement';
import { polyArea } from './src/logic/geometry';
import type { FurnItem, PlacedItem, RoomKind, Vec2 } from './src/types';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));

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
    grid: S().grid!,
    room,
  };
}

const extent = (it: PlacedItem, f: FurnItem) => {
  const r = (it.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { hw: (f.w * c + f.d * s) / 2, hd: (f.w * s + f.d * c) / 2 };
};

/** Non-exempt floor pairs closer than the gap, as [count, worst, worst label]. */
function countBreaches(
  items: PlacedItem[],
  defs: FurnItem[],
  where: string,
  sink: string[],
): { n: number; worst: number } {
  const solid = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ idx }) => defs[idx].mount === 'floor' && !isFlat(defs[idx]));
  let n = 0;
  let worst = Infinity;
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const ai = solid[i];
      const bi = solid[j];
      const fa = defs[ai.idx];
      const fb = defs[bi.idx];
      if (gapAllowed(fa, fb)) continue;
      const ea = extent(ai.it, fa);
      const eb = extent(bi.it, fb);
      const dx = ea.hw + eb.hw - Math.abs(ai.it.x - bi.it.x);
      const dy = ea.hd + eb.hd - Math.abs(ai.it.y - bi.it.y);
      const dist =
        dx > 0 && dy > 0
          ? -Math.min(dx, dy)
          : Math.hypot(Math.max(0, -dx), Math.max(0, -dy));
      if (dist < worst) worst = dist;
      if (dist < MIN_FLOOR_GAP - 0.02) {
        n++;
        if (sink.length < 6) {
          sink.push(`${where}: ${fa.name} / ${fb.name} ${dist.toFixed(2)} m`);
        }
      }
    }
  }
  return { n, worst };
}

const KINDS: RoomKind[] = [
  'living', 'dining', 'bedroom', 'kitchen', 'bathroom', 'office',
  'hall', 'studio', 'nursery', 'laundry', 'pantry', 'guest',
];
const SIZES: [number, number][] = [[5.5, 4.75], [4.5, 3.5], [3.5, 3]];

let fills = 0;
let before = 0;
let after = 0;
let worstBefore = Infinity;
let capBreaches = 0;
let decorBreaches = 0;
let lightBreaches = 0;
let lightDist = Infinity;
const examples: string[] = [];
const leftover: string[] = [];

for (let run = 0; run < 3; run++) {
  for (const kind of KINDS) {
    for (const [w, h] of SIZES) {
      const { items, poly, grid, room } = fill(kind, w, h);
      const defs = items.map((i) => BY.get(i.itemId)!);
      const where = `${kind} ${w}x${h}`;
      fills++;

      const b = countBreaches(items, defs, where, examples);
      before += b.n;
      if (b.worst < worstBefore) worstBefore = b.worst;

      // The same correction, applied a second time by hand.
      resolveOverlaps(grid, poly, items, BY);
      const a = countBreaches(items, defs, where, leftover);
      after += a.n;

      // At most CATEGORY_LIMIT items of a category. Chairs are governed by
      // rule 2, paired decor and runs by the exemptions, and past
      // DUPLICATE_FREE_AREA_MAX the cap lifts — the audit mirrors that.
      const roomArea = Math.abs(polyArea(poly));
      const perType = new Map<string, number>();
      for (const d of defs) {
        if (REPEAT_EXEMPT.has(d.kind) || isFlat(d) || isChair(d)) continue;
        perType.set(d.type, (perType.get(d.type) ?? 0) + 1);
      }
      if (roomArea <= DUPLICATE_FREE_AREA_MAX) {
        for (const [t, n] of perType) {
          if (n > CATEGORY_LIMIT) capBreaches++;
        }
      }

      // At most DECOR_LIMIT decorative items, paired decor apart, in rooms up
      // to the duplicate-free threshold.
      const decorCount = defs.filter(
        (d) => DECOR_TYPES.has(d.type) && !isFlat(d) && !REPEAT_EXEMPT.has(d.kind),
      ).length;
      if (roomArea <= DUPLICATE_FREE_AREA_MAX && decorCount > DECOR_LIMIT) {
        decorBreaches++;
      }

      // Every light at least CEILING_LIGHT_SPACING from every other.
      const lights = items.filter((i) => {
        const d = BY.get(i.itemId)!;
        return d.type === 'ceilight' || d.type === 'walllight' || d.type === 'floorlamp';
      });
      for (let i = 0; i < lights.length; i++) {
        for (let j = i + 1; j < lights.length; j++) {
          const dist = Math.hypot(lights[i].x - lights[j].x, lights[i].y - lights[j].y);
          if (dist < lightDist) lightDist = dist;
          if (dist < CEILING_LIGHT_SPACING - 1e-6) lightBreaches++;
        }
      }
      void room;
    }
  }
}

console.log(`fills: ${fills}`);
console.log(`gap breaches as filled:   ${before}   (worst ${worstBefore.toFixed(2)} m)`);
console.log(`gap breaches after a second pass: ${after}`);
console.log(`category-cap breaches (> ${CATEGORY_LIMIT} per category): ${capBreaches}`);
console.log(`decor-cap breaches (> ${DECOR_LIMIT}): ${decorBreaches}`);
console.log(
  `light-spacing breaches (< ${CEILING_LIGHT_SPACING} m): ${lightBreaches}` +
    (lightDist === Infinity ? '' : ` — closest pair ${lightDist.toFixed(2)} m`),
);
if (examples.length) console.log(`\nworst as filled:\n  ${examples.join('\n  ')}`);
if (leftover.length) console.log(`\nstill there after a second pass:\n  ${leftover.join('\n  ')}`);

S().clearRoom();
