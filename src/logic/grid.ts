// Regular placement grid derived from the drawn floorplan polygon.

import type { Vec2 } from '../types';
import { distPointSeg, pointInPoly, segsCross } from './geometry';

export const CELL = 0.5; // meters per grid cell

export interface Grid {
  ox: number;
  oy: number;
  cols: number;
  rows: number;
  cell: number;
  /** 1 = usable (fully inside the room), 0 = wall/outside. */
  free: Uint8Array;
}

/** Build a grid whose cells lie completely inside the polygon. */
export function buildGrid(poly: Vec2[], cell = CELL): Grid {
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const p of poly) {
    if (p.x < minx) minx = p.x;
    if (p.y < miny) miny = p.y;
    if (p.x > maxx) maxx = p.x;
    if (p.y > maxy) maxy = p.y;
  }
  const cols = Math.max(1, Math.ceil((maxx - minx) / cell - 1e-9));
  const rows = Math.max(1, Math.ceil((maxy - miny) / cell - 1e-9));
  const free = new Uint8Array(cols * rows);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = minx + i * cell;
      const y0 = miny + j * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      const corners: Vec2[] = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      // Every corner must be inside the room...
      let ok = true;
      for (const c of corners) {
        if (!pointInPoly(c, poly)) {
          ok = false;
          break;
        }
      }
      // ...and no wall may cut through the cell.
      if (ok) {
        for (let e = 0, k = poly.length - 1; e < poly.length; k = e++) {
          for (let m = 0; m < 4; m++) {
            if (segsCross(poly[k], poly[e], corners[m], corners[(m + 1) % 4])) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
      }
      free[i + j * cols] = ok ? 1 : 0;
    }
  }
  return { ox: minx, oy: miny, cols, rows, cell, free };
}

export function cellCenter(g: Grid, i: number, j: number): Vec2 {
  return { x: g.ox + (i + 0.5) * g.cell, y: g.oy + (j + 0.5) * g.cell };
}

/** Distance between segment [a,b] and an axis-aligned rect (0 when they touch/cross). */
function segRectDist(a: Vec2, b: Vec2, x0: number, y0: number, x1: number, y1: number): number {
  const inside = (p: Vec2) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  if (inside(a) || inside(b)) return 0;
  const c: Vec2[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const p = c[i];
    const q = c[(i + 1) % 4];
    if (segsCross(a, b, p, q)) return 0;
    best = Math.min(
      best,
      distPointSeg(a, p, q),
      distPointSeg(b, p, q),
      distPointSeg(p, a, b),
      distPointSeg(q, a, b),
    );
  }
  return best;
}

/**
 * Block every grid cell a built wall passes through, so new furniture refuses
 * to land on a partition. Cells outside the room are simply never visited.
 */
export function blockWall(g: Grid, a: Vec2, b: Vec2, margin = 0.1): void {
  const pad = margin;
  const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - pad - g.ox) / g.cell));
  const i1 = Math.min(g.cols - 1, Math.floor((Math.max(a.x, b.x) + pad - g.ox) / g.cell));
  const j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - pad - g.oy) / g.cell));
  const j1 = Math.min(g.rows - 1, Math.floor((Math.max(a.y, b.y) + pad - g.oy) / g.cell));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x0 = g.ox + i * g.cell;
      const y0 = g.oy + j * g.cell;
      if (segRectDist(a, b, x0, y0, x0 + g.cell, y0 + g.cell) <= pad) {
        g.free[i + j * g.cols] = 0;
      }
    }
  }
}

export function isFree(g: Grid, i: number, j: number): boolean {
  if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) return false;
  return g.free[i + j * g.cols] === 1;
}

/**
 * Cells covered by a rect (center x,y, size w,d).
 * Returns null when the rect pokes outside the grid bounds.
 */
export function rectCells(g: Grid, x: number, y: number, w: number, d: number): number[] | null {
  const i0 = Math.floor((x - w / 2 - g.ox) / g.cell + 1e-9);
  const i1 = Math.floor((x + w / 2 - g.ox) / g.cell - 1e-9);
  const j0 = Math.floor((y - d / 2 - g.oy) / g.cell + 1e-9);
  const j1 = Math.floor((y + d / 2 - g.oy) / g.cell - 1e-9);
  if (i0 < 0 || j0 < 0 || i1 >= g.cols || j1 >= g.rows) return null;
  const out: number[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) out.push(i + j * g.cols);
  }
  return out;
}
