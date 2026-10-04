// Room rules that are about relationships between pieces rather than any one
// piece: chairs facing tables, walkways around them, where the cabinets go, and
// how a dining room is laid out.
//
// These run after the fill has placed everything, because they are corrections:
// a chair that ended up facing the wall is turned round, a cabinet that landed
// in the middle of a busy wall is moved to a clear one. Each move is checked
// before it is made, so a correction can never push a piece into something else.

import { canPlace, strictFit, overlapsAllowed, rectsOverlap } from './placement';
import { distPointSeg } from './geometry';
import { isFlat } from './placement';
import type { Grid } from './grid';
import type { FurnItem, PlacedItem, Vec2 } from '../types';

/** Kinds that are a chair someone sits on — not a stool, bench or ottoman. */
const CHAIR_KINDS = new Set(['dining', 'accent', 'armchair', 'office', 'desk']);

/** Kinds that count as "a table" for the purpose of facing one. */
const TABLE_KINDS = new Set(['dining', 'round', 'oval', 'trestle', 'bar', 'banquet', 'desk', 'coffee', 'console', 'side']);

/** Storage that reads as a cabinet or cupboard, which rule 6 governs. */
const CABINET_KINDS = new Set([
  'cabinet',
  'credenza',
  'sideboard',
  'buffet',
  'armoire',
  'wardrobe',
  'basecab',
  'wallcab',
  'pantry',
  'drawerbank',
  'laundrycab',
  'laundrywall',
  'pantrycab',
]);

export function isChair(f: FurnItem): boolean {
  return f.type === 'seating' && CHAIR_KINDS.has(f.kind);
}

export function isTable(f: FurnItem): boolean {
  if (f.type === 'tables' || f.type === 'dining') return TABLE_KINDS.has(f.kind);
  if (f.type === 'kitchen') return f.kind === 'island' || f.kind === 'peninsula';
  if (f.type === 'office') return f.kind === 'desk' || f.kind === 'standing';
  return false;
}

export function isCabinet(f: FurnItem): boolean {
  return CABINET_KINDS.has(f.kind);
}

const norm2 = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** Front direction of an item for a given rotation (local +z). */
const front = (rot: number): Vec2 => {
  const r = (rot * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
};

/** Nearest rotation in 90° steps that points a front vector this way. */
function snapTo90(desired: Vec2): number {
  let best = 0;
  let bestDot = -Infinity;
  for (const rot of [0, 90, 180, 270]) {
    const f = front(rot);
    const dot = f.x * desired.x + f.y * desired.y;
    if (dot > bestDot) {
      bestDot = dot;
      best = rot;
    }
  }
  return best;
}

/** Centre-to-centre distance between two items at their current rotations. */
function gap(a: PlacedItem, fa: FurnItem, b: PlacedItem, fb: FurnItem): number {
  const ra = (a.rot * Math.PI) / 180;
  const rb = (b.rot * Math.PI) / 180;
  const halfA = (fa.w * Math.abs(Math.cos(ra)) + fa.d * Math.abs(Math.sin(ra))) / 2;
  const halfB = (fb.w * Math.abs(Math.cos(rb)) + fb.d * Math.abs(Math.sin(rb))) / 2;
  return Math.hypot(a.x - b.x, a.y - b.y) - halfA - halfB;
}

/** Is this a table a chair could be sat at? */
function tableLike(f: FurnItem): boolean {
  return isTable(f);
}

/**
 * Rule 1 — a chair always faces a table.
 *
 * Only chairs with a table in the room are touched: a chair by a window with
 * nowhere to sit at is not wrong, it is just a chair. A chair already facing its
 * table is left where it is rather than nudged, because turning a correct
 * layout into a different correct layout is churn.
 */
export function chairsFaceTables(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
): void {
  const tables = items.filter((i) => {
    const f = byId.get(i.itemId);
    return f && tableLike(f) && f.mount === 'floor';
  });
  if (!tables.length) return;

  for (const it of items) {
    const f = byId.get(it.itemId);
    if (!f || !isChair(f) || f.mount !== 'floor') continue;

    // The table this chair belongs to is the nearest one it could actually be
    // reached from, not simply the nearest in the room.
    let target: PlacedItem | null = null;
    let bestD = Infinity;
    for (const t of tables) {
      const tf = byId.get(t.itemId)!;
      const d = Math.hypot(t.x - it.x, t.y - it.y);
      if (d > 3.2 || d >= bestD) continue;
      bestD = d;
      target = t;
    }
    if (!target) continue;

    const want = snapTo90(norm2({ x: target.x - it.x, y: target.y - it.y }));
    if (want === it.rot) continue;
    if (canPlace(grid, poly, items, byId, f, it.x, it.y, want, it.uid)) it.rot = want;
  }
}

/** How close a table has to be to count as the one this chair is pulled up to. */
const OWN_TABLE_REACH = 1.6;

/**
 * Rule 2 — walking space around a chair.
 *
 * A chair pushed against a wall or jammed up to the next piece cannot be pulled
 * out, which is the difference between a seat and an obstacle. Each chair is
 * pushed back along its own facing until it has clearance on every side, giving
 * up rather than shoving anything else.
 *
 * The table the chair belongs to is not an obstruction. A dining chair tucked
 * under its table and a seat pulled up to a coffee table are both correct, and
 * counting the table as something to be walked around would have every chair in
 * the room shoved backwards off its own seat.
 */
export function spaceChairs(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  walk: number,
): void {
  for (const it of items) {
    const f = byId.get(it.itemId);
    if (!f || !isChair(f) || f.mount !== 'floor') continue;

    // A chair pulled up to a table is left exactly where it was put.
    //
    // The rule is about being able to walk to a chair and pull it out. Seating
    // around a table has its own logic — chairs a third of a table apart are
    // the whole point — and there is no arrangement of four dining chairs that
    // leaves 60 cm between each pair. Applying the walking gap here meant every
    // dining chair was judged too close to its neighbours and shoved backwards
    // off its place at the table.
    if (items.some((o) => {
      const of = byId.get(o.itemId);
      return (
        of &&
        isTable(of) &&
        of.mount === 'floor' &&
        Math.hypot(o.x - it.x, o.y - it.y) < OWN_TABLE_REACH
      );
    })) {
      continue;
    }

    const clearNow = () => {
      for (const o of items) {
        if (o.uid === it.uid) continue;
        const of = byId.get(o.itemId);
        if (!of || of.mount !== 'floor') continue;
        // A rug is walked on, not around. Treating a chair standing on one as
        // "no walking space" would fail every room with a rug in it.
        if (isFlat(of)) continue;
        if (isTable(of) && Math.hypot(o.x - it.x, o.y - it.y) < OWN_TABLE_REACH) continue;
        if (gap(it, f, o, of) < walk) return false;
      }
      // And off the walls, so it can be walked round.
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (distPointSeg({ x: it.x, y: it.y }, a, b) < walk / 2) return false;
      }
      return true;
    };
    if (clearNow()) continue;

    // Back the chair off along the line away from whatever it is up against.
    const dir = front(it.rot);
    for (let k = 1; k <= 10; k++) {
      const t = k * 0.1;
      const x = it.x - dir.x * t;
      const y = it.y - dir.y * t;
      if (!strictFit(grid, poly, items, byId, f, x, y, it.rot, it.uid)) break;
      it.x = x;
      it.y = y;
      if (clearNow()) break;
    }
  }
}

/**
 * Rule 3 — a living room has a sofa and a chair, both facing the coffee table.
 *
 * The conversation circle already pulls seating towards the sofa; this makes
 * sure the arrangement actually reads as one: the coffee table has to exist, and
 * at least one free-standing chair has to face it rather than sit beside it.
 */
export function livingConversation(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
): void {
  const coffee = items.find((i) => byId.get(i.itemId)?.kind === 'coffee');
  if (!coffee) return;

  for (const it of items) {
    const f = byId.get(it.itemId);
    if (!f || f.mount !== 'floor') continue;
    const isSofa = f.type === 'seating' && (f.kind === 'sofa' || f.kind === 'sectional' || f.kind === 'loveseat');
    if (!isSofa && !isChair(f)) continue;
    const want = snapTo90(norm2({ x: coffee.x - it.x, y: coffee.y - it.y }));
    if (want === it.rot) continue;
    if (canPlace(grid, poly, items, byId, f, it.x, it.y, want, it.uid)) it.rot = want;
  }
}

/**
 * Rule 4 — the dining room: storage on one wall, a table in the middle with two
 * chairs on each side.
 *
 * Two chairs per long side is the arrangement the rule asks for, so chairs are
 * placed by hand rather than left to the fill: two along each long edge of the
 * table, tucked in and square to it.
 */
export function diningLayout(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
): void {
  const table = items.find((i) => {
    const f = byId.get(i.itemId);
    return f && f.type === 'dining' && TABLE_KINDS.has(f.kind);
  });
  if (!table) return;
  const tf = byId.get(table.itemId)!;

  const along = tf.w >= tf.d ? 0 : 90; // long axis of the table
  const halfLong = (along === 0 ? tf.w : tf.d) / 2;
  const halfShort = (along === 0 ? tf.d : tf.w) / 2;
  const ux = along === 0 ? 1 : 0;
  const uy = along === 0 ? 0 : 1;
  const px = along === 0 ? 0 : 1;
  const py = along === 0 ? 1 : 0;

  const chairs = items.filter((i) => {
    const f = byId.get(i.itemId);
    return f && isChair(f) && f.mount === 'floor';
  });
  if (chairs.length < 4) return;
  // The four that belong at the table are the four nearest it — the rest are
  // occasional seating and have no business being tucked in.
  const nearest = [...chairs]
    .sort((a, b) => Math.hypot(a.x - table.x, a.y - table.y) - Math.hypot(b.x - table.x, b.y - table.y))
    .slice(0, 4);

  /** Two chairs per side, a third and two thirds along, clear of the table edge. */
  const seatsAround = (at: Vec2): Vec2[] => {
    const seats: Vec2[] = [];
    for (const side of [1, -1]) {
      for (const frac of [-1 / 3, 1 / 3]) {
        seats.push({
          x: at.x + ux * halfLong * frac + px * (halfShort + 0.32) * side,
          y: at.y + uy * halfLong * frac + py * (halfShort + 0.32) * side,
        });
      }
    }
    return seats;
  };

  /**
   * The table has to be willing to move.
   *
   * The fill is happy to put a dining table flat against a wall, which leaves
   * one whole side with nowhere to sit — and the rule asks for a table in the
   * centre with two chairs on each side, so a table that cannot be seated on
   * both sides is in the wrong place, not merely surrounded by chairs.
   *
   * Candidate positions are tried nearest-first and the one that seats the most
   * chairs wins, so the table moves as little as it has to. Searching a small
   * patch around the table rather than a straight line to the centre is what
   * lets it step around a sideboard; searching only that line left it stuck
   * whenever anything was in the way on one side.
   */
  const candidates: Vec2[] = [{ x: table.x, y: table.y }];
  const RING = [0.4, 0.8, 1.2];
  for (const r of RING) {
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      candidates.push({ x: table.x + dx * r, y: table.y + dy * r });
    }
  }
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  candidates.push({ x: cx, y: cy });

  let best: { pos: Vec2; seats: Vec2[]; placed: number[]; count: number } | null = null;
  const saved = nearest.map((c) => ({ x: c.x, y: c.y, rot: c.rot }));
  const tableSaved = { x: table.x, y: table.y };

  for (const pos of candidates) {
    if (!strictFit(grid, poly, items, byId, tf, pos.x, pos.y, table.rot, table.uid)) continue;
    table.x = pos.x;
    table.y = pos.y;
    const seats = seatsAround(pos);
    const placed: number[] = [];
    for (let i = 0; i < 4; i++) {
      const chair = nearest[i];
      const f = byId.get(chair.itemId)!;
      // Its own seat first, then the seat directly opposite, then either of the
      // other two. A chair that cannot reach its assigned seat has to go to
      // another seat at the table rather than staying loose: the four left where
      // the fill dropped them is the arrangement the rule exists to prevent.
      for (const s of [i, (i + 2) % 4, (i + 1) % 4, (i + 3) % 4]) {
        const seat = seats[s];
        const rot = snapTo90(norm2({ x: pos.x - seat.x, y: pos.y - seat.y }));
        if (strictFit(grid, poly, items, byId, f, seat.x, seat.y, rot, chair.uid)) {
          chair.x = seat.x;
          chair.y = seat.y;
          chair.rot = rot;
          placed.push(i);
          break;
        }
      }
    }
    // Strictly greater, so the nearest candidate wins a tie.
    if (!best || placed.length > best.count) best = { pos, seats, placed, count: placed.length };
    if (placed.length === 4) break;
    // Undo before trying the next candidate.
    nearest.forEach((c, i) => {
      c.x = saved[i].x;
      c.y = saved[i].y;
      c.rot = saved[i].rot;
    });
    table.x = tableSaved.x;
    table.y = tableSaved.y;
  }

  if (best) {
    table.x = best.pos.x;
    table.y = best.pos.y;
    best.placed.forEach((i) => {
      const chair = nearest[i];
      const seat = best!.seats[i];
      const rot = snapTo90(norm2({ x: best!.pos.x - seat.x, y: best!.pos.y - seat.y }));
      chair.x = seat.x;
      chair.y = seat.y;
      chair.rot = rot;
    });
    // Any chair that could not be seated gets one more chance, close to its
    // seat rather than exactly on it. The seat itself may be blocked by a
    // neighbour already tucked in, while a hand's breadth to one side is not —
    // and staying at the table on the correct side of it is what the rule is
    // about, not the exact centimetre.
    nearest.forEach((c, i) => {
      if (best!.placed.includes(i)) return;
      const f = byId.get(c.itemId)!;
      const seat = best!.seats[i];
      // Sliding along the table's long axis keeps the chair on the side of the
      // table the rule asked for.
      for (const shift of [0.3, 0.45, 0.6, 0.2, 0.75]) {
        for (const along of [0, 1, -1]) {
          const x = seat.x + ux * along * shift;
          const y = seat.y + uy * along * shift;
          const rot = snapTo90(norm2({ x: best!.pos.x - x, y: best!.pos.y - y }));
          if (!strictFit(grid, poly, items, byId, f, x, y, rot, c.uid)) continue;
          c.x = x;
          c.y = y;
          c.rot = rot;
          best!.placed.push(i);
          return;
        }
      }
      // Still nothing: it stays where the fill put it.
      c.x = saved[i].x;
      c.y = saved[i].y;
      c.rot = saved[i].rot;
    });
  }
}

/**
 * Rule 6 — cabinets and cupboards go on a wall that has no other furniture.
 *
 * A run of cabinets wants a blank wall to work against; dropped into the middle
 * of a busy one they read as an obstruction. Each cabinet is offered every edge
 * and takes the first whose wall run is clear of other floor furniture.
 */
export function cabinetsOnClearWall(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
): void {
  const cabinets = items.filter((i) => {
    const f = byId.get(i.itemId);
    return f && isCabinet(f) && f.mount === 'floor';
  });
  if (!cabinets.length) return;

  // How far along an edge counts as "this wall".
  const WALL_RUN = 2.2;
  // Where along a wall a cabinet may stand. The middle first, because a
  // cabinet centred on a wall reads best, then off to either side. Offering
  // only the midpoint left a cabinet stranded in the middle of the room
  // whenever that one spot was already taken.
  const ALONG = [0.5, 0.32, 0.68, 0.16, 0.84];

  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  const centre = { x: sx / poly.length, y: sy / poly.length };

  for (const cab of cabinets) {
    const cf = byId.get(cab.itemId)!;
    let best: { x: number; y: number; rot: number; score: number } | null = null;

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < cf.w * 0.8) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // Face into the room, then stand off the wall by half its own depth so
      // its back ends up on the plaster.
      const inward = norm2({ x: centre.x - mx, y: centre.y - my });
      const rot = snapTo90(inward);
      const rad = (rot * Math.PI) / 180;
      const tw = cf.w * Math.abs(Math.cos(rad)) + cf.d * Math.abs(Math.sin(rad));
      const td = cf.w * Math.abs(Math.sin(rad)) + cf.d * Math.abs(Math.cos(rad));
      const inset = (tw * Math.abs(inward.x) + td * Math.abs(inward.y)) / 2 + 0.02;

      for (const t of ALONG) {
        const along = Math.min(Math.max(len * t, tw / 2), Math.max(len - tw / 2, tw / 2));
        const px = a.x + ((b.x - a.x) / len) * along + inward.x * inset;
        const py = a.y + ((b.y - a.y) / len) * along + inward.y * inset;
        if (!strictFit(grid, poly, items, byId, cf, px, py, rot, cab.uid)) continue;

        // How crowded is this stretch of wall?
        let crowded = 0;
        for (const o of items) {
          if (o.uid === cab.uid) continue;
          const of = byId.get(o.itemId);
          if (!of || of.mount !== 'floor' || isCabinet(of)) continue;
          if (distPointSeg({ x: o.x, y: o.y }, a, b) < WALL_RUN) crowded++;
        }
        if (!best || crowded < best.score) best = { x: px, y: py, rot, score: crowded };
      }
    }

    // Only move if the cabinet is not already on the clearest wall available.
    if (!best) continue;
    if (best.x === cab.x && best.y === cab.y) continue;
    cab.x = best.x;
    cab.y = best.y;
    cab.rot = best.rot;
  }
}

/** Half-extents of a placed item at its current rotation. */
function extent(it: PlacedItem, f: FurnItem): { hw: number; hd: number } {
  const r = (it.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { hw: (f.w * c + f.d * s) / 2, hd: (f.w * s + f.d * c) / 2 };
}

/**
 * The last word: no two pieces of furniture stand inside each other.
 *
 * Everything above this point places, rotates, tucks and re-seats pieces, and
 * each of those moves is checked on its own terms — but a piece is judged
 * against the room as it stood when it moved, not as later moves left it. Two
 * corrections that each fit perfectly can still leave a chair 30 cm inside a
 * sideboard, and a room with a chair inside a sideboard looks broken in a way no
 * amount of correct individual placement excuses.
 *
 * So this runs last and treats overlap as the defect it is. The shallower
 * piece is walked out along the axis it overlaps least on, the short way out,
 * and if that will not go it is turned a quarter turn instead. Anything it
 * cannot fix it leaves alone rather than shoving the room around to no purpose.
 */
export function resolveOverlaps(
  grid: Grid,
  poly: Vec2[],
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
  opts?: { rotate?: boolean },
): void {
  const solid = items.filter((i) => {
    const f = byId.get(i.itemId);
    return f && f.mount === 'floor' && !isFlat(f);
  });
  const allowRotate = opts?.rotate !== false;

  for (let i = 0; i < solid.length; i++) {
    const a = solid[i];
    const fa = byId.get(a.itemId)!;
    const ea = extent(a, fa);
    for (let j = i + 1; j < solid.length; j++) {
      const b = solid[j];
      const fb = byId.get(b.itemId)!;
      // A chair tucked under its own table is meant to share space.
      if (overlapsAllowed(fa, fb)) continue;
      const eb = extent(b, fb);
      if (!rectsOverlap(a.x, a.y, ea.hw * 2, ea.hd * 2, b.x, b.y, eb.hw * 2, eb.hd * 2)) continue;

      // Who moves: the smaller piece, unless one of them is a cabinet. A cabinet
      // belongs against a wall, and sliding one into the middle of the room to
      // settle a disagreement with an accent chair trades a small overlap for a
      // clear breach of the cabinet rule.
      const cabinetA = isCabinet(fa);
      const cabinetB = isCabinet(fb);
      const mover = cabinetA !== cabinetB
        ? (cabinetA ? b : a)
        : fa.w * fa.d <= fb.w * fb.d
          ? a
          : b;
      const other = mover === a ? b : a;
      const mf = mover === a ? fa : fb;
      const pushX = Math.abs(a.x - b.x) < ea.hw + eb.hw - 0.02
        ? (ea.hw + eb.hw - Math.abs(a.x - b.x)) / 2 + 0.03
        : 0;
      const pushY = Math.abs(a.y - b.y) < ea.hd + eb.hd - 0.02
        ? (ea.hd + eb.hd - Math.abs(a.y - b.y)) / 2 + 0.03
        : 0;
      const axis: { dir: Vec2; cost: number }[] = [];
      if (pushX > 0) axis.push({ dir: { x: Math.sign(mover.x - other.x) || 1, y: 0 }, cost: pushX });
      if (pushY > 0) axis.push({ dir: { x: 0, y: Math.sign(mover.y - other.y) || 1 }, cost: pushY });
      axis.sort((p, q) => p.cost - q.cost);

      for (const { dir, cost } of axis) {
        // Start at the distance that actually clears the overlap, not at a step
        // from where the piece is now. Asking strictFit about a position still
        // inside the neighbour is pointless — it says no, as it must, and a
        // pass that gave up there would leave the overlap exactly as it found
        // it.
        for (let t = cost; t <= cost + 1.5; t += 0.05) {
          const x = mover.x + dir.x * t;
          const y = mover.y + dir.y * t;
          if (!strictFit(grid, poly, items, byId, mf, x, y, mover.rot, mover.uid)) continue;
          mover.x = x;
          mover.y = y;
          if (!overlapsAny(mover, mf, items, byId)) break;
        }
        if (!overlapsAny(mover, mf, items, byId)) break;
      }
      if (!overlapsAny(mover, mf, items, byId)) continue;

      // Sliding will not do it — try standing it the other way round. This is
      // opt-out because turning a chair to get it out of a sideboard would leave
      // it facing the wrong way, breaking a rule this pass exists to protect.
      if (!allowRotate) continue;
      for (const rot of [90, 180, 270]) {
        if (!strictFit(grid, poly, items, byId, mf, mover.x, mover.y, rot, mover.uid)) continue;
        mover.rot = rot;
        if (!overlapsAny(mover, mf, items, byId)) break;
      }
    }
  }
}

/** Does this piece still stand inside anything it should not? */
function overlapsAny(
  it: PlacedItem,
  f: FurnItem,
  items: PlacedItem[],
  byId: Map<string, FurnItem>,
): boolean {
  const e = extent(it, f);
  return items.some((o) => {
    if (o.uid === it.uid) return false;
    const of = byId.get(o.itemId);
    if (!of || of.mount !== 'floor' || isFlat(of) || overlapsAllowed(f, of)) return false;
    const eo = extent(o, of);
    return rectsOverlap(it.x, it.y, e.hw * 2, e.hd * 2, o.x, o.y, eo.hw * 2, eo.hd * 2);
  });
}

/**
 * Rule 5 support — which items may appear more than once.
 *
 * The rule bans duplicate pieces with two exceptions, and the fill needs to know
 * them: chairs (a dining table is *meant* to have several) and cabinets (a run
 * of them is one piece of joinery). In a large room repeats are allowed beyond
 * that, because a big open space cannot be furnished from a fixed list without
 * them.
 */
export function repeatable(f: FurnItem): boolean {
  return isChair(f) || isCabinet(f);
}