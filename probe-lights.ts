/**
 * Rule 1 extended to every kind of light: are the lights 3 m apart, and how
 * many lights does a room actually end up with?
 */
import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import type { FurnItem, PlacedItem, RoomKind, Vec2 } from './src/types';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));
const LIGHT_TYPES = new Set(['ceilight', 'walllight', 'floorlamp']);

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
  return S().items.filter((i) => i.roomId === room.id);
}

const KINDS: RoomKind[] = [
  'living', 'dining', 'bedroom', 'kitchen', 'bathroom', 'office',
  'hall', 'studio', 'nursery', 'laundry', 'pantry', 'guest',
];

let worst = Infinity;
let worstPair = '';
let total = 0;
let oneOrNone = 0;
const rows: string[] = [];

for (const kind of KINDS) {
  for (const [w, h] of [[5.5, 4.75], [4.5, 3.5], [3.5, 3]] as [number, number][]) {
    const items = fill(kind, w, h);
    const lights = items.filter((i) => LIGHT_TYPES.has(BY.get(i.itemId)!.type));
    total++;
    if (lights.length <= 1) oneOrNone++;
    let min = Infinity;
    let pair = '';
    for (let i = 0; i < lights.length; i++) {
      for (let j = i + 1; j < lights.length; j++) {
        const d = Math.hypot(lights[i].x - lights[j].x, lights[i].y - lights[j].y);
        if (d < min) {
          min = d;
          pair = `${BY.get(lights[i].itemId)!.name} / ${BY.get(lights[j].itemId)!.name}`;
        }
      }
    }
    if (min < worst) {
      worst = min;
      worstPair = `${kind} ${w}x${h}: ${pair}`;
    }
    rows.push(
      `${kind.padEnd(8)} ${w}x${h}  lights=${lights.length}  closest=${
        lights.length < 2 ? '  n/a' : min.toFixed(2)
      } m`,
    );
  }
}

console.log(rows.join('\n'));
console.log(`\nrooms with at most one light: ${oneOrNone} of ${total}`);
console.log(
  worst === Infinity
    ? 'no room has two lights to compare'
    : `closest light pair anywhere: ${worst.toFixed(2)} m (${worstPair})`,
);
S().clearRoom();
