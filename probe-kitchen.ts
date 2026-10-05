import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import { distPointSeg } from './src/logic/geometry';

const S = () => useStore.getState();
const BY = new Map(LIBRARY.map((f) => [f.id, f]));

const kind = (process.argv[2] as string) || 'kitchen';
S().clearRoom();
S().askRoom(null);
S().setMode('draw');
S().setTier('max');
S().addRoom([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4.5 }, { x: 0, y: 4.5 }]);
const room = S().rooms[0];
S().describeRoom(room.id, { name: '', kind: kind as any, note: '' });
S().clearItems();
S().aiFill();
const mine = S().items.filter((i) => i.roomId === room.id);
const poly = S().rooms[0].poly;

let casegoods = 0;
let offwall = 0;
for (const it of mine) {
  const f = BY.get(it.itemId)!;
  let g = Infinity;
  for (let i0 = 0, j = poly.length - 1; i0 < poly.length; j = i0++) {
    const a = poly[j], b = poly[i0];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const half = (f.w * Math.abs(nx) + f.d * Math.abs(ny)) / 2;
    const d = distPointSeg({ x: it.x, y: it.y }, a, b) - half;
    if (d < g) g = d;
  }
  const casegood = f.mount === 'floor' && (f.type === 'storage' || f.type === 'kitchen' || f.type === 'closet');
  if (casegood) casegoods++;
  if (casegood && g > 0.1 + 0.005) offwall++;
  console.log(
    `  ${f.mount.padEnd(8)} ${f.type.padEnd(10)} ${f.kind.padEnd(14)} ${f.name.padEnd(28)} x=${it.x.toFixed(2)} y=${it.y.toFixed(2)} rot=${it.rot} gapToWall=${g.toFixed(2)}`,
  );
}
console.log(`casegoods: ${casegoods}, off-wall (>0.1m): ${offwall}`);
S().clearRoom();
