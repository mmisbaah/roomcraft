import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));
const kind = process.argv[2] as string || 'bedroom';

S().clearRoom();
S().askRoom(null);
S().setMode('draw');
S().setTier('max');
S().addRoom([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4.5 }, { x: 0, y: 4.5 }]);
const room = S().rooms[0];
S().describeRoom(room.id, { name: '', kind: kind as any, note: '' });
S().clearItems();
S().aiFill();
const mine = S().items.filter((i) => i.roomId === room.id);
const counts: Record<string, number> = {};
for (const it of mine) {
  const f = BY.get(it.itemId)!;
  counts[f.kind] = (counts[f.kind] ?? 0) + 1;
}
console.log(infer=kind, JSON.stringify(counts, null, 1));
S().clearRoom();
