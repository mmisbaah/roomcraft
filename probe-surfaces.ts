import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { supportTop } from './src/logic/placement';
import type { RoomKind } from './src/types';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));

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
  return S().items.filter((i) => i.roomId === room.id);
}

for (let r = 0; r < 6; r++) {
  const items = fill('living', 5.5, 4.75);
  console.log(`--- run ${r} ---`);
  for (const it of items) {
    const f = BY.get(it.itemId)!;
    console.log(
      `  ${f.mount.padEnd(8)} ${f.type.padEnd(9)} ${f.kind.padEnd(11)} ${f.name.padEnd(26)} at ${it.x.toFixed(2)},${it.y.toFixed(2)} mount ${f.mount}`,
    );
  }
}
S().clearRoom();
