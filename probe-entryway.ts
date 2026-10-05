import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { isFlat, isChair } from './src/logic/placement';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));

for (const [w, h] of [[8, 6]] as [number, number][]) {
  S().clearRoom();
  S().askRoom(null);
  S().setMode('draw');
  S().setTier('max');
  S().addRoom([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
  const room = S().rooms[0];
  S().describeRoom(room.id, { name: '', kind: 'entryway', note: '' });
  S().clearItems();
  S().aiFill();
  const mine = S().items.filter((i) => i.roomId === room.id);
  const area = w * h;
  let hard = 0;
  for (const it of mine) {
    const f = BY.get(it.itemId)!;
    const mark = f.mount === 'floor' && !isFlat(f) ? '*' : ' ';
    if (f.mount === 'floor' && !isFlat(f)) hard += f.w * f.d;
    console.log(`${mark} ${f.mount.padEnd(8)} ${f.type.padEnd(10)} ${f.kind.padEnd(12)} ${f.name.padEnd(28)} ${f.w}x${f.d} at ${it.x.toFixed(2)},${it.y.toFixed(2)} rot ${it.rot}`);
  }
  console.log(`floor area used: ${hard.toFixed(2)} of ${area} = ${((hard / area) * 100).toFixed(1)}%`);
}
S().clearRoom();
