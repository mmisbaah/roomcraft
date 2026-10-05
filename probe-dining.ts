/**
 * Rule 4's chair distribution goes 3/1 about half the time now. Reproduce it
 * and report what the odd chair is doing — which side it ended on, what is
 * next to it, and whether it was the placement or a later correction that put
 * it there.
 */
import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { isChair } from './src/logic/roomrules';
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
  };
}

let bad = 0;
let good = 0;

for (let run = 0; run < 30; run++) {
  const { items } = fill('dining', 6, 5);
  const table = items.find((i) => BY.get(i.itemId)?.type === 'dining');
  const chairs = items.filter((i) => isChair(BY.get(i.itemId)!));
  if (!table || chairs.length < 4) continue;
  const tf = BY.get(table.itemId)!;
  const atTable = [...chairs]
    .sort(
      (a, b) =>
        Math.hypot(a.x - table.x, a.y - table.y) - Math.hypot(b.x - table.x, b.y - table.y),
    )
    .slice(0, 4);
  const along = tf.w >= tf.d;
  const perSide = [0, 0];
  for (const c of atTable) {
    const v = along ? c.y - table.y : c.x - table.x;
    perSide[Math.sign(v) > 0 ? 0 : 1]++;
  }
  if (perSide.every((n) => n === 2)) {
    good++;
    continue;
  }
  bad++;

  console.log(`\nrun ${run}: ${perSide.join(' / ')}  table ${tf.name} ${tf.w}x${tf.d} rot ${table.rot} at ${table.x.toFixed(2)},${table.y.toFixed(2)} (along=${along})`);
  for (const c of atTable) {
    const f = BY.get(c.itemId)!;
    const v = along ? c.y - table.y : c.x - table.x;
    const u = along ? c.x - table.x : c.y - table.y;
    console.log(
      `  ${f.name.padEnd(24)} side ${Math.sign(v) > 0 ? '+' : '-'}  v=${v.toFixed(2)} u=${u.toFixed(2)} rot ${c.rot}`,
    );
  }
  // Every piece in the room, so the layout can be read as a whole.
  console.log('  all items:');
  for (const o of items) {
    const of = BY.get(o.itemId)!;
    console.log(
      `    ${of.name.padEnd(26)} ${of.type.padEnd(9)} ${of.kind.padEnd(9)} ` +
        `x=${o.x.toFixed(2)} y=${o.y.toFixed(2)} rot=${o.rot} mount=${of.mount}` +
        (isChair(of) ? '  [chair]' : ''),
    );
  }
}

console.log(`\n2/2 in ${good} runs, other in ${bad} runs`);
S().clearRoom();
