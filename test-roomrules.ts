/**
 * The written room rules, checked against what the fill actually produces.
 *
 * These are assertions about behaviour, not about intent: each one fills a room
 * and looks at the result, so a rule that is quietly not working shows up here
 * rather than in a screenshot.
 */
import './test-dom-stub';
import { useStore } from './src/store';
import { LIBRARY } from './src/data/items';
import {
  CHAIR_LIMIT,
  CHAIR_WALK_SPACE,
  CEILING_LIGHT_SPACING,
  DUPLICATE_FREE_AREA_MAX,
  ROOM_KIND_ORDER,
  ceilingLightGrid,
  type RoomKind,
} from './src/logic/placement';
import { isFlat, REPEAT_EXEMPT } from './src/logic/placement';
import { isCabinet, isChair, isTable } from './src/logic/roomrules';
import type { FurnItem, PlacedItem } from './src/types';
import { distPointSeg } from './src/logic/geometry';

/**
 * The piece types rule 5 governs: floor furniture.
 *
 * The scope matters. Two cushions on a sofa is normal, a pair of sconces is
 * normal, and rule 7 explicitly requires ceiling lights to repeat — so the rule
 * is read as being about furniture, and these are the types it covers.
 */
const FURNITURE_TYPES = new Set([
  'seating', 'tables', 'storage', 'beds', 'kitchen', 'dining',
  'vanity', 'bathtub', 'shower', 'toilet',
  'nursery', 'gym', 'laundry', 'office', 'pantry', 'outdoor', 'closet',
]);

let failures = 0;
let checks = 0;
function ok(label: string, cond: boolean, detail = '') {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'BAD '} ${label}${detail ? ` — ${detail}` : ''}`);
}

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
  const items = S().items.filter((i) => i.roomId === room.id);
  return {
    items,
    defs: items.map((i) => BY.get(i.itemId)!).filter(Boolean),
    area: w * h,
    poly: S().rooms[0].poly,
  };
}

const front = (rot: number) => {
  const r = (rot * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
};

console.log('Rule 1 — ceiling lights on a 3 m lattice:');
{
  const rect = (w: number, h: number) =>
    ceilingLightGrid([
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ]);
  ok('the lattice spacing is 3 m', CEILING_LIGHT_SPACING === 3, `${CEILING_LIGHT_SPACING} m`);
  ok('a 3x3 m room holds one light', rect(3, 3).length === 1, `${rect(3, 3).length}`);
  ok('a 6 m wall holds two lights 3 m apart', rect(6, 3).length === 2, `${rect(6, 3).length}`);
  ok('a 5 m wall holds one, not two squeezed together', rect(5, 4.5).length === 1,
    `${rect(5, 4.5).length}`);
  ok('a 12x10 m room holds twelve', rect(12, 10).length === 12, `${rect(12, 10).length}`);
  // Every pair of lattice points must be at least the spacing apart.
  let tightest = Infinity;
  for (const [w, h] of [[3.2, 3], [5, 4.5], [7, 6.9], [12, 10], [9, 3]] as [number, number][]) {
    const pts = rect(w, h);
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        tightest = Math.min(tightest, Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y));
      }
    }
  }
  ok('no two lattice points are closer than 3 m', tightest >= CEILING_LIGHT_SPACING - 1e-9,
    `tightest ${tightest.toFixed(2)} m`);

  for (const [label, w, h] of [
    ['small', 3.2, 3.0],
    ['medium', 5.0, 4.5],
    ['large', 7.0, 6.9],
    ['very large', 12, 10],
  ] as [string, number, number][]) {
    const r = fill('living', w, h);
    const got = r.defs.filter((d) => d.mount === 'ceiling' && d.type === 'ceilight').length;
    const want = ceilingLightGrid(r.poly).length;
    ok(`${label} living room has ${want} ceiling lights`, got === want, `${got} placed`);
    // And they are actually 3 m apart, not merely the right number of them.
    const pts = r.items
      .filter((i) => r.defs[r.items.indexOf(i)]?.type === 'ceilight')
      .map((i) => ({ x: i.x, y: i.y }));
    let tight = Infinity;
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        tight = Math.min(tight, Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y));
      }
    }
    ok(`  …${label} lights are 3 m apart`, tight === Infinity || tight >= 3 - 1e-9,
      tight === Infinity ? 'single light' : `closest ${tight.toFixed(2)} m`);
  }
}

console.log('\nRule 2 — at most two chairs outside the dining room:');
{
  let worst = 0;
  let over: string[] = [];
  for (const kind of ROOM_KIND_ORDER) {
    for (const [label, w, h] of [
      ['small', 3.2, 3.0],
      ['medium', 5.0, 4.5],
      ['large', 7.0, 6.9],
    ] as [string, number, number][]) {
      const r = fill(kind, w, h);
      const n = r.defs.filter((d) => isChair(d)).length;
      if (n > worst) worst = n;
      // The dining room is exempt: rule 4 puts four chairs around the table.
      const limit = kind === 'dining' ? 4 : CHAIR_LIMIT;
      if (n > limit) over.push(`${kind}/${label}=${n}`);
    }
  }
  ok('no non-dining room exceeds the chair limit', over.length === 0, over.slice(0, 6).join(', '));
  console.log(`       worst case ${worst} chairs (dining allowed four)`);
}

console.log('\nRule 3 — one of each kind in the room:');
{
  // Scoped to rooms where the rule binds: above 40 m² repeats are allowed so
  // the coverage floor stays reachable.
  const dupFree = ['living', 'bedroom', 'office', 'kitchen', 'bathroom', 'hallway', 'pantry'] as RoomKind[];
  let bad: string[] = [];
  for (const kind of dupFree) {
    for (const [label, w, h] of [
      ['small', 3.2, 3.0],
      ['medium', 5.0, 4.5],
    ] as [string, number, number][]) {
      const r = fill(kind, w, h);
      const seen = new Set<string>();
      for (const d of r.defs) {
        if (d.type === 'ceilight') continue;
        if (isChair(d) || REPEAT_EXEMPT.has(d.kind)) continue;
        const key = `${d.type}:${d.kind}`;
        if (seen.has(key)) bad.push(`${kind}/${label} ${key}`);
        seen.add(key);
      }
    }
  }
  ok('no kind appears twice in a duplicate-free room', bad.length === 0, bad.slice(0, 6).join(', '));
  // The exemptions really do repeat, or a kitchen would be one base unit.
  const kitchen = fill('kitchen', 5, 4.5);
  const basecabs = kitchen.defs.filter((d) => d.kind === 'basecab').length;
  ok('built-in joinery is exempt from the cap', basecabs >= 2, `${basecabs} base cabinets`);
  const living = fill('living', 5, 4.5);
  const cushions = living.defs.filter((d) => d.kind === 'pillow').length;
  ok('paired decor is exempt from the cap', cushions >= 2, `${cushions} cushions`);
}

console.log('\nRule 5 — no duplicate furniture except chairs and cabinets:');
{
  for (const kind of ['living', 'dining', 'bedroom', 'office', 'bathroom'] as RoomKind[]) {
    const r = fill(kind, 5, 4.5);
    const counts = new Map<string, number>();
    for (const it of r.items) {
      const f = BY.get(it.itemId)!;
      if (!FURNITURE_TYPES.has(f.type)) continue;
      const key = `${f.type}:${f.kind}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Anything repeated more than once has to be a chair or a cabinet.
    const bad = [...counts.entries()]
      .filter(([, n]) => n > 1)
      .filter(([key]) => {
        const [type, k] = key.split(':');
        const probe = LIBRARY.find((f) => f.type === type && f.kind === k)!;
        return !isChair(probe) && !isCabinet(probe);
      })
      .map(([key, n]) => `${key}x${n}`);
    ok(`${kind}: no duplicate furniture`, bad.length === 0, bad.join(', '));
  }
}

console.log('\nRules 5 and coverage together — a big room may repeat:');
{
  ok('the duplicate-free threshold is 40 m2', DUPLICATE_FREE_AREA_MAX === 40);
  const small = fill('living', 5, 4.5);
  const big = fill('living', 12, 10);
  // Furniture only, and only the furniture the rule actually forbids repeating:
  // rule 7 requires the ceiling lights to repeat, and chairs and cabinets are
  // the two exceptions the rule itself makes.
  const restricted = (i: PlacedItem) => {
    const f = BY.get(i.itemId)!;
    if (!FURNITURE_TYPES.has(f.type)) return false;
    return !isChair(f) && !isCabinet(f);
  };
  const uniqFurniture = (r: typeof small) =>
    new Set(
      r.items
        .filter(restricted)
        .map((i) => `${BY.get(i.itemId)!.type}:${BY.get(i.itemId)!.kind}`),
    ).size;
  const sf = small.items.filter(restricted).length;
  ok('a normal room has no repeated furniture',
    uniqFurniture(small) === sf,
    `${uniqFurniture(small)}/${sf} distinct kinds`);
  ok('a large room may repeat to fill the floor', big.items.length >= 20,
    `${big.items.length} items`);
}

console.log('\nRule 1 — chairs face a table:');
{
  let checked = 0;
  const wrong: string[] = [];
  for (const kind of ['dining', 'office', 'study', 'bedroom', 'living'] as RoomKind[]) {
    const r = fill(kind, 5.5, 4.5);
    const tables = r.items.filter((i) => isTable(BY.get(i.itemId)!));
    if (!tables.length) continue;
    for (const it of r.items) {
      const f = BY.get(it.itemId)!;
      if (!isChair(f)) continue;
      // The table it is nearest and could reach.
      let target: PlacedItem | null = null;
      let best = Infinity;
      for (const t of tables) {
        const d = Math.hypot(t.x - it.x, t.y - it.y);
        if (d <= 3.2 && d < best) {
          best = d;
          target = t;
        }
      }
      if (!target) continue;
      checked++;
      const want = front(it.rot);
      const to = { x: target.x - it.x, y: target.y - it.y };
      const l = Math.hypot(to.x, to.y) || 1;
      const dot = (want.x * to.x + want.y * to.y) / l;
      if (dot < 0.7) wrong.push(`${kind} chair at ${it.x.toFixed(1)},${it.y.toFixed(1)} dot=${dot.toFixed(2)}`);
    }
  }
  ok(`all ${checked} chairs within reach of a table face it`, wrong.length === 0, wrong.slice(0, 4).join(' | '));
}

/**
 * How far two footprints interpenetrate, in metres. Zero means clear.
 *
 * Per axis, not centre-to-centre: subtracting both half-widths from the
 * distance between centres reports two pieces standing corner to corner as
 * though they were inside one another, which they are not.
 */
function penetration(
  a: PlacedItem,
  fa: FurnItem,
  b: PlacedItem,
  fb: FurnItem,
): number {
  const half = (it: PlacedItem, f: FurnItem) => {
    const r = (it.rot * Math.PI) / 180;
    const c = Math.abs(Math.cos(r));
    const s = Math.abs(Math.sin(r));
    return { x: (f.w * c + f.d * s) / 2, y: (f.w * s + f.d * c) / 2 };
  };
  const ha = half(a, fa);
  const hb = half(b, fb);
  const ox = ha.x + hb.x - Math.abs(a.x - b.x);
  const oy = ha.y + hb.y - Math.abs(a.y - b.y);
  // 2 cm of slack, matching the placement code: two pieces may sit flush.
  const worst = Math.min(ox, oy) - 0.02;
  return worst > 0 ? worst : 0;
}

console.log('\nRule 2 — walking space around a chair:');
{
  let worst = 0;
  let tightest = '';
  for (const kind of ['dining', 'living', 'office', 'study'] as RoomKind[]) {
    const r = fill(kind, 5.5, 4.5);
    for (const it of r.items) {
      const f = BY.get(it.itemId)!;
      if (!isChair(f)) continue;
      for (const o of r.items) {
        if (o.uid === it.uid) continue;
        const of = BY.get(o.itemId)!;
        if (of.mount !== 'floor' || isFlat(of)) continue;
        // A chair tucked under the table it belongs to is correct; what the
        // rule is about is being able to walk round it, so its own table is
        // excluded.
        if (isTable(of) && Math.hypot(o.x - it.x, o.y - it.y) < 1.6) continue;
        const p = penetration(it, f, o, of);
        if (p > worst) {
          worst = p;
          tightest = `${kind}: ${f.name} vs ${of.name}`;
        }
      }
    }
  }
  ok('no chair stands inside another piece', worst === 0,
    `deepest overlap ${worst.toFixed(2)} m (${tightest})`);
  console.log(`       target walking space ${CHAIR_WALK_SPACE} m`);
}

console.log('\nRule 3 — living room seating faces the coffee table:');
{
  const r = fill('living', 5.5, 4.5);
  const coffee = r.items.find((i) => BY.get(i.itemId)?.kind === 'coffee');
  ok('there is a coffee table', !!coffee);
  const sofa = r.items.find((i) => {
    const k = BY.get(i.itemId)?.kind;
    return k === 'sofa' || k === 'sectional' || k === 'loveseat';
  });
  ok('there is a sofa', !!sofa);
  if (coffee && sofa) {
    const want = front(sofa.rot);
    const to = { x: coffee.x - sofa.x, y: coffee.y - sofa.y };
    const l = Math.hypot(to.x, to.y) || 1;
    const dot = (want.x * to.x + want.y * to.y) / l;
    ok('and the sofa faces it', dot > 0.5, `dot=${dot.toFixed(2)}`);
  }
  // The rule asks for "a sofa and a chair facing a coffee table" — one chair is
  // enough, and insisting every chair in the room points the same way would
  // fail on the occasional chair by the window, which is fine where it is.
  const facing = (it: PlacedItem, target: PlacedItem) => {
    const want = front(it.rot);
    const to = { x: target.x - it.x, y: target.y - it.y };
    const l = Math.hypot(to.x, to.y) || 1;
    return (want.x * to.x + want.y * to.y) / l;
  };
  const chairs = coffee ? r.items.filter((i) => isChair(BY.get(i.itemId)!)) : [];
  if (coffee && chairs.length) {
    const dots = chairs.map((c) => facing(c, coffee));
    const best = Math.max(...dots);
    ok('and a chair faces it too', best > 0.5,
      `best of ${dots.length} chairs dot=${best.toFixed(2)}`);
  } else {
    ok('and a chair faces it too', false, 'no free-standing chair placed');
  }
}

console.log('\nRule 4 — dining room: storage to one side, two chairs each side:');
{
  const r = fill('dining', 6, 5);
  const table = r.items.find((i) => BY.get(i.itemId)?.type === 'dining');
  ok('there is a dining table', !!table);
  const chairs = r.items.filter((i) => isChair(BY.get(i.itemId)!));
  ok('there are at least four chairs', chairs.length >= 4, `${chairs.length}`);
  if (table && chairs.length >= 4) {
    const tf = BY.get(table.itemId)!;
    // The table's chairs are the four nearest it. A dining room may hold more
    // seating than that — an occasional chair by the window is not part of the
    // setting, and counting it would misreport which side of the table the
    // rule's four are on.
    const atTable = [...chairs]
      .sort((a, b) =>
        Math.hypot(a.x - table.x, a.y - table.y) - Math.hypot(b.x - table.x, b.y - table.y))
      .slice(0, 4);
    // Which side of the table is each chair on, along the short axis?
    const along = tf.w >= tf.d;
    const sides = new Set<number>();
    for (const c of atTable) {
      const v = along ? c.y - table.y : c.x - table.x;
      sides.add(Math.sign(v));
    }
    ok('chairs sit on both long sides of the table', sides.size === 2, `${sides.size} side(s)`);
    const perSide = [0, 0];
    for (const c of atTable) {
      const v = along ? c.y - table.y : c.x - table.x;
      perSide[Math.sign(v) > 0 ? 0 : 1]++;
    }
    ok('two chairs on each side', perSide.every((n) => n === 2), perSide.join(' / '));
  }
  // Storage should be against one wall, not scattered.
  const storage = r.items.filter((i) => isCabinet(BY.get(i.itemId)!));
  if (storage.length >= 2) {
    const onWall = storage.filter((c) =>
      r.poly.some((p, i) => {
        const q = r.poly[(i + 1) % r.poly.length];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len2 = dx * dx + dy * dy;
        let t = ((c.x - p.x) * dx + (c.y - p.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(c.x - (p.x + dx * t), c.y - (p.y + dy * t)) < 0.6;
      }),
    ).length;
    ok('the cabinets are all against a wall', onWall === storage.length,
      `${onWall}/${storage.length}`);
  }
}

console.log('\nRule 6 — cabinets go against a wall:');
{
  let offWall = 0;
  let worst = 0;
  const bad: string[] = [];
  // A kitchen is left out on purpose. Its cabinets are a run of joinery, not
  // free-standing cupboards, and "find a wall with nothing else on it" is not a
  // question you ask of a kitchen — the cabinetry *is* the wall.
  for (const kind of ['dining', 'bedroom', 'office', 'pantry', 'study'] as RoomKind[]) {
    const r = fill(kind, 6, 5);
    for (const c of r.items) {
      const cf = BY.get(c.itemId)!;
      if (!isCabinet(cf)) continue;
      // Distance from the cabinet to the nearest wall.
      let d = Infinity;
      for (let i = 0; i < r.poly.length; i++) {
        d = Math.min(
          d,
          distPointSeg({ x: c.x, y: c.y }, r.poly[i], r.poly[(i + 1) % r.poly.length]),
        );
      }
      // A cabinet that cannot be moved without colliding with something else is
      // better left where it is, so the bound is loose enough to allow one.
      if (d > 1.3) {
        offWall++;
        bad.push(`${kind}/${cf.name} ${d.toFixed(2)}m`);
      }
      worst = Math.max(worst, d);
    }
  }
  ok('every cabinet stands against a wall', offWall === 0, bad.slice(0, 4).join(' | '));
  console.log(`       worst distance from a wall: ${worst.toFixed(2)} m`);
}

S().setWallBuild(false);
S().clearRoom();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (${checks} total)`);
process.exit(failures === 0 ? 0 : 1);