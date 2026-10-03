// Low-level 2D computational geometry used by grid + placement.

import type { Vec2 } from '../types';

const EPS = 1e-9;

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ray-casting point-in-polygon test. */
export function pointInPoly(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + EPS) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Shortest distance from point p to segment ab. */
export function distPointSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp01(t);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Proper segment intersection (shared endpoints count as no crossing). */
export function segsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true;
  return false;
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Absolute polygon area (shoelace). */
export function polyArea(poly: Vec2[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(s) / 2;
}

/** The smallest room outline we accept, in m². */
export const MIN_ROOM_AREA = 4;

/**
 * Tidy a raw outline into something safe to store as a room: drop repeated
 * points and near-collinear vertices, and return null when what is left isn't
 * a usable room. Wall loops arrive from clicks that can land on the same spot
 * or nudge a straight run, and both produce zero-length edges that would break
 * edge indexing (openings are one-per-edge) and polygon containment tests.
 */
export function cleanPolygon(poly: Vec2[]): Vec2[] | null {
  const EPS_LEN = 0.05; // 5 cm
  const EPS_CROSS = 0.02; // ~1.1° of bend over a 1 m edge

  // Collapse consecutive duplicates.
  const out: Vec2[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < EPS_LEN) continue;
    out.push({ x: p.x, y: p.y });
  }
  while (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < EPS_LEN) out.pop();
    else break;
  }
  if (out.length < 3) return null;

  // Drop vertices that sit on the straight line between their neighbours.
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const cur = out[i];
      const next = out[(i + 1) % out.length];
      const ax = cur.x - prev.x;
      const ay = cur.y - prev.y;
      const bx = next.x - cur.x;
      const by = next.y - cur.y;
      const len = Math.hypot(ax, ay) * Math.hypot(bx, by);
      if (len < 1e-9) continue;
      if (Math.abs((ax * by - ay * bx) / len) < EPS_CROSS) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  if (out.length < 3) return null;
  if (polyArea(out) < MIN_ROOM_AREA) return null;
  return out;
}

/**
 * Do two polygons share interior area? True when any edge of one crosses the
 * other, or when one is entirely swallowed by the other (no crossing edges but
 * still overlapping floor).
 */
export function polysOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    for (let k = 0, l = b.length - 1; k < b.length; l = k++) {
      if (segsCross(a[j], a[i], b[l], b[k])) return true;
    }
  }
  // No crossings: either disjoint, or one contains the other.
  if (pointInPoly(a[0], b) || pointInPoly(b[0], a)) return true;
  return false;
}

/** Area-weighted centroid; falls back to vertex average for degenerate shapes. */
export function polyCentroid(poly: Vec2[]): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    a += f;
    cx += (poly[j].x + poly[i].x) * f;
    cy += (poly[j].y + poly[i].y) * f;
  }
  a /= 2;
  if (Math.abs(a) < EPS) {
    let sx = 0;
    let sy = 0;
    poly.forEach((p) => {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / poly.length, y: sy / poly.length };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Rotate footprint dimensions for a given rotation (multiples of 90°). */
export function rotatedSize(w: number, d: number, rot: number): { w: number; d: number } {
  return rot % 180 === 0 ? { w, d } : { w: d, d: w };
}

/** True when the axis-aligned rect sits entirely inside the polygon. */
export function rectInsidePoly(poly: Vec2[], x: number, y: number, w: number, d: number): boolean {
  const corners: Vec2[] = [
    { x: x - w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y + d / 2 },
    { x: x - w / 2, y: y + d / 2 },
  ];
  for (const c of corners) if (!pointInPoly(c, poly)) return false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    for (let k = 0; k < 4; k++) {
      if (segsCross(poly[j], poly[i], corners[k], corners[(k + 1) % 4])) return false;
    }
  }
  return true;
}

/** Distance from a point to the closest polygon edge. */
export function distToWalls(p: Vec2, poly: Vec2[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const dd = distPointSeg(p, poly[j], poly[i]);
    if (dd < best) best = dd;
  }
  return best;
}
