// Keyboard movement / rotation / deletion for the selected object.
// Shared by the 2D canvas and the 3D scene so the same shortcuts work in both modes.

import { useStore, edgesOf } from '../store';
import { distPointSeg } from './geometry';
import { ITEM_INDEX } from '../data/items';

/** Fine nudge step — 0.1 m for precise positioning. */
const FINE_STEP = 0.1;
/** Shift = one metre per press (coarse). */
const COARSE = 1;

type DirProvider = (() => { dx: number; dy: number }) | undefined;

/**
 * Handle object hotkeys: arrows / WASD nudge the selection, R rotates,
 * Del removes. Returns true when the event was handled (state may have
 * changed — the caller can redraw). No-ops when nothing is selected so
 * the keys stay free for the rest of the UI.
 * 
 * Optional `dirMap` provides camera-relative directions for 3D mode:
 * - Keys map to functions returning {dx, dy} in store 2D coordinates
 * - If not provided, uses default world axes (2D mode)
 */
export function objectHotkey(e: KeyboardEvent, dirMap?: Record<string, DirProvider>): boolean {
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return false;
  // leave browser shortcuts (Ctrl+R reload, etc.) alone
  if (e.ctrlKey || e.metaKey || e.altKey) return false;

  const st = useStore.getState();
  if (!st.selected) return false;

  // Default to fine step (0.1 m); Shift = coarse (1 m)
  const step = e.shiftKey ? COARSE : FINE_STEP;
  let dx = 0;
  let dy = 0;

  // First, check if we have a custom direction provider for this key
  if (dirMap && dirMap[e.key]) {
    const dir = dirMap[e.key]?.();
    if (dir) {
      dx = dir.dx * step;
      dy = dir.dy * step;
    } else {
      // key in dirMap but returned undefined -> not handled
    }
  } else {
    // Default world-axis directions (2D mode)
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        dx = -step;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        dx = step;
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        dy = step; // world y grows upward on screen
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        dy = -step;
        break;
      case 'r':
      case 'R':
        st.rotateSelected();
        return true;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        st.removeSelected();
        return true;
      default:
        return false;
    }
  }

  const it = st.items.find((i) => i.uid === st.selected);
  if (!it) return false;

  // Wall-item fix: if the item is wall-mounted and the movement would be
  // perpendicular to its wall (which projects back to the same spot),
  // project the nudge onto the wall tangent so ALL arrows slide the item
  // along the wall. This makes arrow keys useful on all walls.
  const itemDef = ITEM_INDEX.get(it.itemId);
  if (itemDef && itemDef.mount === 'wall' && st.room) {
    const edges = edgesOf(st.room, st.openings, st.walls);
    // Find the wall this item is attached to (nearest non-door edge)
    let bestEdge: { a: { x: number; y: number }; b: { x: number; y: number }; kind: string } | null = null;
    let bestD = Infinity;
    for (const edge of edges) {
      if (edge.kind === 'door') continue;
      const d = distPointSeg({ x: it.x, y: it.y }, edge.a, edge.b);
      if (d < bestD) {
        bestD = d;
        bestEdge = edge;
      }
    }
    if (bestEdge) {
      // Wall tangent (unit vector along the wall)
      const tx = bestEdge.b.x - bestEdge.a.x;
      const ty = bestEdge.b.y - bestEdge.a.y;
      const len = Math.hypot(tx, ty);
      if (len > 0) {
        const ux = tx / len;
        const uy = ty / len;
        // Project the requested movement onto the tangent
        const proj = dx * ux + dy * uy;
        // If perpendicular component dominates (|proj| < step/2), fall back to
        // sliding along the wall using the sign of the dominant requested axis
        if (Math.abs(proj) < step / 2) {
          // Use the axis with larger absolute requested movement
          const fallback = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
          dx = ux * Math.sign(fallback) * step;
          dy = uy * Math.sign(fallback) * step;
        } else {
          // Scale tangential movement to step size
          dx = ux * Math.sign(proj) * step;
          dy = uy * Math.sign(proj) * step;
        }
      }
    }
  }

  e.preventDefault(); // arrows must not scroll the page mid-nudge
  return st.tryMoveFine(it.uid, it.x + dx, it.y + dy);
}