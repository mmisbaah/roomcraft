import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));
const kind = (process.argv[2] as string) || 'living';
S().clearRoom();
S().askRoom(null);
S().setMode('draw');
S().setTier('max');
S().addRoom([{ x: 0, y: 0 }, { x: 5.5, y: 0 }, { x: 5.5, y: 4.5 }, { x: 0, y: 4.5 }]);
const room = S().rooms[0];
S().describeRoom(room.id, { name: '', kind: kind as any, note: '' });
S().clearItems();
S().aiFill();
const mine = S().items.filter((i) => i.roomId === room.id);
for (const it of mine) {
  const f = BY.get(it.itemId)!;
  console.log(`  ${f.mount.padEnd(8)} ${f.type.padEnd(10)} ${f.kind.padEnd(13)} ${f.name}  at ${it.x.toFixed(2)},${it.y.toFixed(2)}`);
}
console.log('toast:', S().toast?.msg ?? S().toastMsg ?? '(none)');
S().clearRoom();
