// Finding the rooms that a set of walls encloses.
//
// The 🧱 tool records walls, not rooms. A user traces three sides of a bedroom
// and the fourth side is already there — it belongs to the neighbouring room
// they drew first — and the loop is closed without them ever clicking back to
// the start point. Nothing in the wall list says "those four walls make a
// room", because a wall is just a segment. This module answers that question by
// treating the walls as a planar graph and walking its faces: every bounded
// face is a stretch of floor somebody has boxed in.

import type { BuiltWall, Vec2 } from '../types';

/** Corners closer than this are the same corner. */
const WELD = 0.05;

/** A stretch of floor fully enclosed by walls. */
export interface EnclosedFace {
  /** Boundary in order. */
  poly: Vec2[];
  /** The walls that form this boundary, including any shared with a neighbour. */
  wallIds: string[];
  /** Unsigned area in m². */
  area: number;
}

/**
 * Every bounded region the walls enclose.
 *
 * Walks each face of the wall graph by always turning as far clockwise as
 * possible from the way it arrived — the standard left-hand rule — which traces
 * enclosed floors anticlockwise and the single unbounded outside face
 * clockwise. That is why the outside is found by sign rather than by size: it
 * is the one face on the other side, however small the plan is.
 *
 * `alsoCloseWith` adds edges that can complete a loop without being walls
 * themselves. Room outlines are the important case: a room drawn earlier owns
 * the edge your new wall runs into, so the loop is closed by somebody else's
 * wall and the free-wall graph on its own would never show it. Those edges are
 * used for detection only — anything returned that is not a real wall id must
 * not be treated as one.
 *
 * Only faces at least `minArea` are returned, which drops the slivers a
 * doubled-up wall or two walls meeting end-on-end would otherwise produce.
 */
export function findEnclosedFaces(
  walls: BuiltWall[],
  alsoCloseWith: ReadonlyArray<{ id: string; a: Vec2; b: Vec2 }> = [],
  minArea = 0.01,
): EnclosedFace[] {
  const edges: Array<{ id: string; a: Vec2; b: Vec2 }> = [...walls, ...alsoCloseWith];
  if (edges.length < 3) return [];

  // ---------------------------------------------------------- weld corners
  // Two walls only join if their endpoints are the same corner. Snapping makes
  // that exact, but a wall drawn before a snap change, or one traced against a
  // room outline, can be a few millimetres out, so endpoints within WELD are
  // treated as one vertex. Bucketed by a grid so this stays near-linear rather
  // than comparing every endpoint with every other.
  const verts: Vec2[] = [];
  const buckets = new Map<string, number[]>();
  const vertexAt = (p: Vec2): number => {
    const cx = Math.floor(p.x / WELD);
    const cy = Math.floor(p.y / WELD);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const near = buckets.get(`${cx + dx},${cy + dy}`);
        if (!near) continue;
        for (const vi of near) {
          if (Math.hypot(verts[vi].x - p.x, verts[vi].y - p.y) <= WELD) return vi;
        }
      }
    }
    const id = verts.length;
    verts.push({ x: p.x, y: p.y });
    const key = `${cx},${cy}`;
    const b = buckets.get(key);
    if (b) b.push(id);
    else buckets.set(key, [id]);
    return id;
  };

  // ------------------------------------------------------------ half-edges
  // Every wall is two directed edges so a face can be walked with the floor on
  // one consistent side.
  const tail: number[] = [];
  const head: number[] = [];
  const ofWall: number[] = [];
  for (let i = 0; i < edges.length; i++) {
    const a = vertexAt(edges[i].a);
    const b = vertexAt(edges[i].b);
    // A zero-length wall cannot bound anything.
    if (a === b) continue;
    tail.push(a);
    head.push(b);
    ofWall.push(i);
    tail.push(b);
    head.push(a);
    ofWall.push(i);
  }
  const heCount = tail.length;
  if (heCount < 6) return []; // fewer than 3 walls — nothing can enclose

  /** reverse half-edge of i, and next/prev around its tail */
  const rev = new Int32Array(heCount);
  for (let i = 0; i < heCount; i += 2) {
    rev[i] = i + 1;
    rev[i + 1] = i;
  }

  // Outgoing half-edges per vertex, sorted anticlockwise so "the next one
  // clockwise" is simply the previous entry.
  const outgoing: number[][] = [];
  for (let i = 0; i < heCount; i++) {
    const t = tail[i];
    (outgoing[t] ??= []).push(i);
  }
  for (let v = 0; v < verts.length; v++) {
    const list = outgoing[v];
    if (!list || list.length < 2) continue;
    list.sort((p, q) => angle(verts, tail[p], head[p]) - angle(verts, tail[q], head[q]));
  }

  // ----------------------------------------------------------------- faces
  const seen = new Uint8Array(heCount);
  const faces: { poly: Vec2[]; wallIds: string[]; signed: number }[] = [];

  for (let start = 0; start < heCount; start++) {
    if (seen[start]) continue;
    const poly: Vec2[] = [];
    const wallIds: string[] = [];
    let he = start;
    let guard = 0;
    // A face cannot revisit a half-edge, so this terminates; the guard is only
    // there so a malformed graph can never hang the UI.
    do {
      seen[he] = 1;
      const w = edges[ofWall[he]];
      if (wallIds[wallIds.length - 1] !== w.id) wallIds.push(w.id);
      poly.push({ x: verts[tail[he]].x, y: verts[tail[he]].y });

      const v = head[he];
      const list = outgoing[v];
      if (!list || list.length === 0) break;
      // Arrive at v along `he`, so the edge we came in on is rev[he]; step to
      // the previous one anticlockwise and that keeps the same face on our left.
      let at = list.indexOf(rev[he]);
      if (at < 0) at = 0;
      he = list[(at - 1 + list.length) % list.length];
    } while (he !== start && ++guard <= heCount);

    if (poly.length >= 3) faces.push({ poly, wallIds, signed: shoelace(poly) });
  }

  if (!faces.length) return [];

  // The outside is the face on the opposite side from the enclosed floors, and
  // it is the one with the largest area — so classify by the sign it carries
  // rather than by guessing an orientation that depends on the y axis.
  let outer = faces[0];
  for (const f of faces) if (Math.abs(f.signed) > Math.abs(outer.signed)) outer = f;
  const outerSign = Math.sign(outer.signed);

  const out: EnclosedFace[] = [];
  for (const f of faces) {
    if (Math.sign(f.signed) === outerSign) continue;
    const area = Math.abs(f.signed);
    if (area < minArea) continue;
    out.push({ poly: f.poly, wallIds: f.wallIds, area });
  }
  return out;
}

function angle(verts: Vec2[], from: number, to: number): number {
  return Math.atan2(verts[to].y - verts[from].y, verts[to].x - verts[from].x);
}

/** Signed shoelace area — the sign carries which way the face was walked. */
function shoelace(poly: Vec2[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return s / 2;
}