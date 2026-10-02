// 2D floorplan canvas: draw walls, place furniture, drag to fine-tune.

import { useCallback, useEffect, useRef, useState } from 'react';
import { canvas2DRef } from '../refs';
import { snapWallPoint, useStore } from '../store';
import { objectHotkey } from '../logic/hotkeys';
import { distPointSeg, polyCentroid } from '../logic/geometry';
import { CELL } from '../logic/grid';
import { ITEM_INDEX } from '../data/items';
import type { EdgeKind, FurnItem, PlacedItem, Vec2 } from '../types';
import { TYPE_ICON } from '../types';

const PAD = 56;
/** Fixed px-per-meter while drawing so clicks map predictably to the room. */
const DRAW_SCALE = 72;
/** Ground tone — fills the whole viewport so there is never any void. */
const GROUND = '#d9e5cb';
const EDGE_KIND_COLOR: Record<EdgeKind, string> = {
  wall: '#2c3242',
  window: '#5aa9e6',
  door: '#c9a227',
};

/** Draw/hit order: rug(0) → floor(1) → surface(2) → wall(3) → ceiling(4). */
function rankOf(f: FurnItem): number {
  if (f.mount === 'floor') return f.spec.rug ? 0 : 1;
  return f.mount === 'surface' ? 2 : f.mount === 'wall' ? 3 : 4;
}

/** Bathroom fixtures get recognisable plan symbols instead of a back strip. */
const BATH2D = new Set(['vanity', 'bathtub', 'shower', 'toilet', 'towelrack', 'vamirror']);

/** Items sorted bottom → top (last drawn is hit first). */
function sortItems(list: PlacedItem[]): PlacedItem[] {
  return [...list].sort((a, b) => {
    const fa = ITEM_INDEX.get(a.itemId);
    const fb = ITEM_INDEX.get(b.itemId);
    return (fa ? rankOf(fa) : 1) - (fb ? rankOf(fb) : 1);
  });
}

interface View {
  zoom: number;
  panX: number;
  panY: number;
}

function fitView(cw: number, ch: number, pts: Vec2[]): { scale: number; cx: number; cy: number } {
  if (!pts.length) return { scale: DRAW_SCALE, cx: 0, cy: 0 };
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const p of pts) {
    if (p.x < minx) minx = p.x;
    if (p.y < miny) miny = p.y;
    if (p.x > maxx) maxx = p.x;
    if (p.y > maxy) maxy = p.y;
  }
  const bw = Math.max(maxx - minx, 2);
  const bh = Math.max(maxy - miny, 2);
  const scale = Math.min((cw - PAD * 2) / bw, (ch - PAD * 2) / bh);
  return { scale, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 };
}

/** While drawing a new room keep a stable fixed-scale view; otherwise fit the room. */
function currentFit(
  cw: number,
  ch: number,
  st: { room: Vec2[] | null; draft: Vec2[] | null; mode: string },
): { scale: number; cx: number; cy: number } {
  if (!st.room && st.mode === 'draw') return { scale: DRAW_SCALE, cx: 0, cy: 0 };
  return fitView(cw, ch, st.room ?? st.draft ?? []);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

export default function Canvas2D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<Vec2 | null>(null);
  const hoverEdgeRef = useRef<number>(-1);
  const hoverWallRef = useRef<string | null>(null);
  /** Wall-tool click recorded on pointer-down; fires on a clean pointer-up. */
  const wallPendingRef = useRef<{ kind: 'add'; p: Vec2 } | { kind: 'delete'; id: string } | null>(null);
  const viewRef = useRef<View>({ zoom: 1, panX: 0, panY: 0 });
  const dragRef = useRef<{ uid: string; ox: number; oy: number; moved: boolean } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  /** Active pointers — two fingers turn a gesture into pinch-zoom / two-finger pan. */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    d0: number;
    mx: number;
    my: number;
    zoom0: number;
    panX0: number;
    panY0: number;
  } | null>(null);
  /** Touch long-press — the right-click menu equivalent on touch devices. */
  const longPressRef = useRef<{ x: number; y: number; timer: number } | null>(null);
  /** Draw-mode corner waiting for a clean tap-up (so a pinch can cancel it). */
  const draftPendingRef = useRef<{ p: Vec2; x: number; y: number } | null>(null);
  const drawFnRef = useRef<() => void>(() => {});
  const toolbarRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({ w: 800, h: 600 });

  // Subscribed slices — they only trigger a redraw.
  const room = useStore((s) => s.room);
  const draft = useStore((s) => s.draft);
  const items = useStore((s) => s.items);
  const selected = useStore((s) => s.selected);
  const openings = useStore((s) => s.openings);
  const grid = useStore((s) => s.grid);
  const mode = useStore((s) => s.mode);
  const edgeEdit = useStore((s) => s.edgeEdit);
  const walls = useStore((s) => s.walls);
  const wallBuild = useStore((s) => s.wallBuild);
  const wallDraft = useStore((s) => s.wallDraft);

  // ---------------------------------------------------------------- drawing
  const draw = useCallback(() => {
    const cv = canvas2DRef.current;
    if (!cv) return;
    const st = useStore.getState();
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = size.w;
    const ch = size.h;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // background — ground everywhere
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, cw, ch);

    const poly = st.room ?? st.draft ?? [];
    const cursor = cursorRef.current;
    const fit = currentFit(cw, ch, st);
    const view = viewRef.current;
    const scale = fit.scale * view.zoom;

    const sx = (wx: number) => (wx - fit.cx) * scale + cw / 2 + view.panX;
    const sy = (wy: number) => ch / 2 + view.panY - (wy - fit.cy) * scale;
    const toWorld = (px: number, py: number): Vec2 => ({
      x: (px - cw / 2 - view.panX) / scale + fit.cx,
      y: (ch / 2 + view.panY - py) / scale + fit.cy,
    });
    (drawFnRef.current as any)._toWorld = toWorld;

    // site grid across the entire ground (drawn before the room so the
    // floorplan reads as standing on terrain)
    if (scale >= 14) {
      const tl = toWorld(0, 0);
      const br = toWorld(cw, ch);
      const x0 = Math.floor(Math.min(tl.x, br.x));
      const x1 = Math.ceil(Math.max(tl.x, br.x));
      const y0 = Math.floor(Math.min(tl.y, br.y));
      const y1 = Math.ceil(Math.max(tl.y, br.y));
      ctx.strokeStyle = 'rgba(70, 92, 60, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) {
        const px = sx(x);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, ch);
      }
      for (let y = y0; y <= y1; y++) {
        const py = sy(y);
        ctx.moveTo(0, py);
        ctx.lineTo(cw, py);
      }
      ctx.stroke();
    }

    if (!poly.length && !st.wallBuild) {
      ctx.fillStyle = '#9aa3b5';
      ctx.font = '15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click to place the first corner of your room', cw / 2, ch / 2 - 8);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(
        'Draw along the walls — click each corner, then click the first point to close',
        cw / 2,
        ch / 2 + 18,
      );
      return;
    }

    // floor
    ctx.beginPath();
    poly.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    if (st.room) ctx.closePath();
    ctx.fillStyle = '#faf8f4';
    ctx.fill();

    // grid (clipped to the floor)
    if (st.room && st.grid) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(70, 84, 120, 0.10)';
      ctx.lineWidth = 1;
      const g = st.grid;
      for (let i = 0; i <= g.cols; i++) {
        const x = sx(g.ox + i * g.cell);
        ctx.beginPath();
        ctx.moveTo(x, sy(g.oy));
        ctx.lineTo(x, sy(g.oy + g.rows * g.cell));
        ctx.stroke();
      }
      for (let j = 0; j <= g.rows; j++) {
        const y = sy(g.oy + j * g.cell);
        ctx.beginPath();
        ctx.moveTo(sx(g.ox), y);
        ctx.lineTo(sx(g.ox + g.cols * g.cell), y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---------------------------------------------------------------- items
    const sorted = sortItems(st.items);
    for (const it of sorted) {
      const f = ITEM_INDEX.get(it.itemId);
      if (!f) continue;
      const color = f.colors[it.colorIdx] ?? f.color;
      // Local footprint inside ctx.rotate — never the AABB swap, or the
      // footprint would appear unrotated (double-swap with the rotate call).
      const { w, d } = { w: f.w, d: f.d };
      const cx = sx(it.x);
      const cy = sy(it.y);
      const rw = w * scale;
      const rd = d * scale;
      const isCeil = f.mount === 'ceiling';
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-it.rot * Math.PI) / 180);
      if (isCeil) ctx.globalAlpha = 0.55;

      if (f.mount === 'floor' && f.spec.rug) {
        ctx.globalAlpha = 0.92;
        if (f.spec.round) {
          ctx.beginPath();
          ctx.arc(0, 0, rw / 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = Math.max(3, scale * 0.05);
          ctx.strokeStyle = f.accent;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, rw / 2 - Math.max(6, scale * 0.12), 0, Math.PI * 2);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.stroke();
        } else {
          roundRectPath(ctx, -rw / 2, -rd / 2, rw, rd, Math.min(8, rw * 0.08));
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = Math.max(3, scale * 0.05);
          ctx.strokeStyle = f.accent;
          ctx.stroke();
          if (f.spec.stripe) {
            ctx.save();
            ctx.clip();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 3;
            const n = Math.max(3, Math.round(rw / 26));
            for (let k = 1; k < n; k++) {
              const x = -rw / 2 + (rw * k) / n;
              ctx.beginPath();
              ctx.moveTo(x, -rd / 2);
              ctx.lineTo(x, rd / 2);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        continue;
      }

      // shadow (skipped for ceiling pieces — they read as a dashed plan symbol)
      if (!isCeil) {
        ctx.shadowColor = 'rgba(30, 40, 70, 0.18)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
      }
      roundRectPath(ctx, -rw / 2, -rd / 2, rw, rd, Math.min(10, Math.min(rw, rd) * 0.18));
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = isCeil ? 2 : 1.5;
      ctx.strokeStyle = isCeil ? 'rgba(20, 26, 40, 0.55)' : 'rgba(20, 26, 40, 0.35)';
      if (isCeil) ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // accent strip along the "back" edge (reads as backrest / headboard);
      // bathroom fixtures instead draw a recognisable plan symbol
      const strip = Math.min(rd * 0.28, scale * 0.16);
      if (!BATH2D.has(f.type)) {
        ctx.fillStyle = f.accent;
        roundRectPath(ctx, -rw / 2 + 3, -rd / 2 + 3, rw - 6, Math.max(4, strip), 4);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(1.4, scale * 0.03);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        if (f.type === 'bathtub') {
          // inner basin outline + drain + faucet pair on the back edge
          const ins = Math.max(4, Math.min(rw, rd) * 0.14);
          roundRectPath(ctx, -rw / 2 + ins, -rd / 2 + ins, rw - ins * 2, rd - ins * 2, Math.max(3, (rd - ins * 2) / 2));
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(2, scale * 0.04), 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-rw * 0.05, -rd / 2 + 2);
          ctx.lineTo(-rw * 0.05, rd * 0.1);
          ctx.moveTo(rw * 0.05, -rd / 2 + 2);
          ctx.lineTo(rw * 0.05, rd * 0.1);
          ctx.stroke();
        } else if (f.type === 'toilet') {
          // tank against the back edge, bowl + seat in front of it
          const tankH = Math.max(5, rd * 0.3);
          roundRectPath(ctx, -rw * 0.4, -rd / 2 + 2, rw * 0.8, tankH, 3);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(0, rd * 0.1, rw * 0.4, Math.max(4, rd * 0.3), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(0, rd * 0.1, rw * 0.24, Math.max(3, rd * 0.17), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (f.type === 'shower') {
          // dashed stall walls + drain
          ctx.setLineDash([5, 4]);
          const ins = Math.max(4, Math.min(rw, rd) * 0.12);
          roundRectPath(ctx, -rw / 2 + ins, -rd / 2 + ins, rw - ins * 2, rd - ins * 2, 3);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(rw * 0.24, rd * 0.24, Math.max(2, scale * 0.04), 0, Math.PI * 2);
          ctx.stroke();
        } else if (f.type === 'vanity') {
          // basin + faucet pair
          ctx.beginPath();
          ctx.ellipse(0, rd * 0.06, Math.max(4, rw * 0.16), Math.max(3, rd * 0.26), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-rw * 0.1, -rd * 0.2);
          ctx.lineTo(-rw * 0.1, 0);
          ctx.moveTo(rw * 0.1, -rd * 0.2);
          ctx.lineTo(rw * 0.1, 0);
          ctx.stroke();
        } else if (f.type === 'towelrack') {
          // two hung towels
          ctx.globalAlpha = 0.75;
          roundRectPath(ctx, -rw * 0.34, -rd * 0.34, rw * 0.26, rd * 0.68, 2);
          ctx.fill();
          roundRectPath(ctx, rw * 0.06, -rd * 0.34, rw * 0.26, rd * 0.68, 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (f.type === 'vamirror') {
          // reflection shine across the glass
          ctx.beginPath();
          ctx.moveTo(-rw * 0.3, rd / 2 - 1);
          ctx.lineTo(rw * 0.3, -rd / 2 + 1);
          ctx.moveTo(rw * 0.02, rd / 2 - 1);
          ctx.lineTo(rw * 0.34, -rd / 2 + 1);
          ctx.stroke();
        }
      }

      // icon + label
      ctx.globalAlpha = 1;
      const dark = luminance(color) < 0.55;
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.95)' : 'rgba(30,36,52,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const showIcon =
        f.mount === 'wall' ? rw > scale * 0.5 : Math.min(rw, rd) > scale * 0.42;
      if (showIcon) {
        ctx.font = `${Math.min(22, Math.max(13, scale * 0.24))}px system-ui, sans-serif`;
        ctx.fillText(TYPE_ICON[f.type], 0, strip * 0.4 + 2);
      }
      const showLabel =
        f.mount === 'wall'
          ? rw > scale * 1.2
          : Math.min(rw, rd) > scale * 0.62 && rw > scale * 1.1;
      if (showLabel) {
        ctx.font = `600 ${Math.max(10, Math.min(13, scale * 0.16))}px system-ui, sans-serif`;
        let label = f.name;
        const maxChars = Math.floor(rw / (scale * 0.1));
        if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
        ctx.fillText(label, 0, f.mount === 'wall' ? strip * 0.4 + 2 : rd / 2 - Math.max(12, scale * 0.22));
      }

      // selection
      if (st.selected === it.uid) {
        ctx.strokeStyle = '#4f6df5';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        roundRectPath(ctx, -rw / 2 - 3, -rd / 2 - 3, rw + 6, rd + 6, 8);
        ctx.stroke();
        ctx.fillStyle = '#4f6df5';
        for (const [hx, hy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          ctx.beginPath();
          ctx.arc((hx * rw) / 2, (hy * rd) / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ------------------------------------------- floating selection toolbar
    const tb = toolbarRef.current;
    if (tb) {
      const show = !!st.selected && st.mode === 'furnish' && !st.edgeEdit && !st.wallBuild;
      const sel = show ? st.items.find((i) => i.uid === st.selected) : null;
      if (!sel) {
        tb.style.display = 'none';
      } else {
        const f = ITEM_INDEX.get(sel.itemId);
        const halfW = ((f ? f.w : 0.5) * scale) / 2;
        const halfD = ((f ? f.d : 0.5) * scale) / 2;
        tb.style.display = 'flex';
        tb.style.left = `${sx(sel.x)}px`;
        tb.style.top = `${sy(sel.y) - halfD - 14}px`;
        const rotBtn = tb.querySelector('[data-act="rotate"]') as HTMLElement | null;
        if (rotBtn && f) {
          rotBtn.textContent = f.mount === 'wall' ? 'Next wall' : 'Rotate 90°';
        }
        void halfW;
      }
    }

    // -------------------------------------------------------------- walls
    const pts = st.room ?? st.draft ?? [];
    const n = pts.length;
    const closeRoom = !!st.room;
    const edgeCount = closeRoom ? n : n - 1;
    for (let i = 0; i < edgeCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const kind: EdgeKind = closeRoom ? st.openings[i] ?? 'wall' : 'wall';
      const hovered = hoverEdgeRef.current === i && st.edgeEdit;
      const x1 = sx(a.x);
      const y1 = sy(a.y);
      const x2 = sx(b.x);
      const y2 = sy(b.y);

      if (kind === 'window') {
        ctx.strokeStyle = EDGE_KIND_COLOR.window;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.strokeStyle = '#eaf4fd';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (kind === 'door') {
        // gap with jambs
        ctx.strokeStyle = '#eef1f6';
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.strokeStyle = EDGE_KIND_COLOR.door;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        // jambs
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 7;
        const ny = (dx / len) * 7;
        ctx.lineWidth = 4;
        for (const [px, py] of [
          [x1, y1],
          [x2, y2],
        ]) {
          ctx.beginPath();
          ctx.moveTo(px - nx, py - ny);
          ctx.lineTo(px + nx, py + ny);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = hovered ? '#4f6df5' : EDGE_KIND_COLOR.wall;
        ctx.lineWidth = hovered ? 8 : 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // -------------------------------------------------- built walls (🧱 tool)
    for (const w of st.walls) {
      const hovered =
        st.wallBuild && !st.wallDraft?.length && hoverWallRef.current === w.id;
      ctx.strokeStyle = hovered ? '#4f6df5' : EDGE_KIND_COLOR.wall;
      ctx.lineWidth = hovered ? 8 : 6;
      ctx.beginPath();
      ctx.moveTo(sx(w.a.x), sy(w.a.y));
      ctx.lineTo(sx(w.b.x), sy(w.b.y));
      ctx.stroke();
      if (st.wallBuild) {
        ctx.fillStyle = hovered ? '#4f6df5' : '#6b7285';
        for (const p of [w.a, w.b]) {
          ctx.beginPath();
          ctx.arc(sx(p.x), sy(p.y), 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // wall draft chain: committed points, rubber band to the snapped target,
    // close hint
    if (st.wallBuild && st.wallDraft?.length) {
      const chain = st.wallDraft;
      // Preview exactly where the click would land (vertex / source-wall /
      // aligned-axis snap), so alignment with the starting wall is visible
      // before committing.
      const target = cursor ? snapWallPoint(cursor, st.room, st.walls, chain, st.wallRef) : null;
      ctx.strokeStyle = '#4f6df5';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      chain.forEach((p, i) =>
        i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y)),
      );
      if (target) ctx.lineTo(sx(target.x), sy(target.y));
      ctx.stroke();
      chain.forEach((p, i) => {
        const isClose =
          i === 0 &&
          chain.length >= 3 &&
          cursor &&
          Math.hypot(cursor.x - p.x, cursor.y - p.y) < 0.4;
        ctx.fillStyle = isClose ? '#16a34a' : i === 0 ? '#4f6df5' : '#ffffff';
        ctx.strokeStyle = '#4f6df5';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), isClose ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.lineJoin = 'miter';
    }

    // vertices (always in draw mode, in edge-edit mode too)
    if (!st.room || st.edgeEdit) {
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), i === 0 ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#4f6df5' : '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4f6df5';
        ctx.stroke();
      });
    }

    // rubber band while drawing
    if (st.draft && cursor && st.draft.length) {
      const last = st.draft[st.draft.length - 1];
      ctx.strokeStyle = 'rgba(79,109,245,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(sx(last.x), sy(last.y));
      ctx.lineTo(sx(cursor.x), sy(cursor.y));
      ctx.stroke();
      ctx.setLineDash([]);
      // close hint
      const first = st.draft[0];
      if (st.draft.length >= 3 && Math.hypot(cursor.x - first.x, cursor.y - first.y) < 0.45) {
        ctx.beginPath();
        ctx.arc(sx(first.x), sy(first.y), 13, 0, Math.PI * 2);
        ctx.strokeStyle = '#22a06b';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#22a06b';
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('close', sx(first.x), sy(first.y) - 20);
      }
    }

    // room label
    if (st.room) {
      const c = polyCentroid(st.room);
      let area = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        area += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
      }
      area = Math.abs(area) / 2;
      ctx.fillStyle = 'rgba(44,50,66,0.55)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${area.toFixed(1)} m²`, sx(c.x), sy(c.y));
    }
  }, [size]);

  drawFnRef.current = draw;

  // ---------------------------------------------------------------- resize
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // redraw on state changes / resize
  useEffect(() => {
    draw();
  }, [draw, room, draft, items, selected, openings, grid, mode, edgeEdit, walls, wallBuild, wallDraft]);

  // reset view when a new room appears
  useEffect(() => {
    viewRef.current = { zoom: 1, panX: 0, panY: 0 };
    draw();
  }, [room, draw]);

  // close the context menu on any outside pointer-down
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const m = ctxRef.current;
      if (m && m.style.display !== 'none' && !m.contains(e.target as Node)) hideCtxMenu();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

  // ------------------------------------------------------------ interaction
  const toWorld = (e: { clientX: number; clientY: number }): Vec2 => {
    const cv = canvas2DRef.current!;
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const cw = size.w;
    const ch = size.h;
    const st = useStore.getState();
    const fit = currentFit(cw, ch, st);
    const view = viewRef.current;
    const scale = fit.scale * view.zoom;
    return {
      x: (px - cw / 2 - view.panX) / scale + fit.cx,
      y: (ch / 2 + view.panY - py) / scale + fit.cy,
    };
  };

  const hitItem = (p: Vec2): PlacedItem | null => {
    // Mirror the draw order: top rank (ceiling) first, then array order.
    const st = useStore.getState();
    const sorted = sortItems(st.items);
    for (let i = sorted.length - 1; i >= 0; i--) {
      const it = sorted[i];
      const f = ITEM_INDEX.get(it.itemId);
      if (!f) continue;
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const r = (it.rot * Math.PI) / 180;
      const lx = dx * Math.cos(r) + dy * Math.sin(r);
      const ly = -dx * Math.sin(r) + dy * Math.cos(r);
      if (Math.abs(lx) <= f.w / 2 + 0.05 && Math.abs(ly) <= f.d / 2 + 0.05) return it;
    }
    return null;
  };

  const hitEdge = (p: Vec2): number => {
    const st = useStore.getState();
    if (!st.room) return -1;
    const poly = st.room;
    let best = -1;
    let bestD = 0.22; // ~ tolerance in meters
    for (let i = 0; i < poly.length; i++) {
      const dd = distPointSeg(p, poly[i], poly[(i + 1) % poly.length]);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    return best;
  };

  /** Built wall under the cursor (wall-tool hover / delete), or null. */
  const hitBuiltWall = (p: Vec2): string | null => {
    const st = useStore.getState();
    let best: string | null = null;
    let bestD = 0.14; // ~ tolerance in meters
    for (const w of st.walls) {
      const dd = distPointSeg(p, w.a, w.b);
      if (dd < bestD) {
        bestD = dd;
        best = w.id;
      }
    }
    return best;
  };

  /** Nearest room corner / wall endpoint within 0.3 m, for vertex snapping. */
  const snapNearestVertex = (p: Vec2, st: ReturnType<typeof useStore.getState>): Vec2 | null => {
    const verts: Vec2[] = [...(st.room ?? [])];
    for (const w of st.walls) verts.push(w.a, w.b);
    let best: Vec2 | null = null;
    let bestD = 0.3;
    for (const v of verts) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  };

  const hideCtxMenu = () => {
    const m = ctxRef.current;
    if (m) m.style.display = 'none';
  };

  // ---------------------------------------------------------- touch helpers
  const clearLongPress = () => {
    const lp = longPressRef.current;
    if (lp) {
      window.clearTimeout(lp.timer);
      longPressRef.current = null;
    }
  };

  /** Arm the right-click-menu equivalent for touch/pen presses. */
  const armLongPress = (x: number, y: number) => {
    clearLongPress();
    longPressRef.current = {
      x,
      y,
      timer: window.setTimeout(() => {
        longPressRef.current = null;
        openCtxMenu(x, y); // selection was already made on pointer-down
      }, 550),
    };
  };

  /** Two fingers down — remember the gesture's starting geometry. */
  const startPinch = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    pinchRef.current = {
      d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
      zoom0: viewRef.current.zoom,
      panX0: viewRef.current.panX,
      panY0: viewRef.current.panY,
    };
  };

  /** Apply pinch zoom + two-finger pan, keeping the world point under the midpoint fixed. */
  const applyPinch = () => {
    const pinch = pinchRef.current;
    const pts = [...pointersRef.current.values()];
    if (!pinch || pts.length < 2) return;
    const [a, b] = pts;
    const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const cv = canvas2DRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const st = useStore.getState();
    const fit = currentFit(size.w, size.h, st);
    const zoom = Math.min(4.5, Math.max(0.35, pinch.zoom0 * (d / pinch.d0)));
    const scale0 = fit.scale * pinch.zoom0;
    const scale = fit.scale * zoom;
    const x0 = pinch.mx - r.left;
    const y0 = pinch.my - r.top;
    const px = mx - r.left;
    const py = my - r.top;
    const wx = (x0 - size.w / 2 - pinch.panX0) / scale0 + fit.cx;
    const wy = (size.h / 2 + pinch.panY0 - y0) / scale0 + fit.cy;
    viewRef.current.zoom = zoom;
    viewRef.current.panX = px - size.w / 2 - (wx - fit.cx) * scale;
    viewRef.current.panY = py - size.h / 2 + (wy - fit.cy) * scale;
    draw();
  };

  const openCtxMenu = (clientX: number, clientY: number) => {
    const m = ctxRef.current;
    const wrap = wrapRef.current;
    if (!m || !wrap) return;
    const r = wrap.getBoundingClientRect();
    m.style.display = 'block';
    // keep the menu inside the canvas wrapper
    const mw = m.offsetWidth;
    const mh = m.offsetHeight;
    const x = Math.min(clientX - r.left, r.width - mw - 8);
    const y = Math.min(clientY - r.top, r.height - mh - 8);
    m.style.left = `${Math.max(8, x)}px`;
    m.style.top = `${Math.max(8, y)}px`;
    const f = useStore.getState().items.find((i) => i.uid === useStore.getState().selected);
    const fi = f ? ITEM_INDEX.get(f.itemId) : null;
    const rotBtn = m.querySelector('[data-act="rotate"]') as HTMLElement | null;
    if (rotBtn && fi) rotBtn.textContent = fi.mount === 'wall' ? 'Next wall' : 'Rotate 90°';
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const st = useStore.getState();
    if (st.wallBuild) {
      // right-click ends the wall chain (or exits the tool)
      if (st.wallDraft?.length) st.finishWallDraft();
      hideCtxMenu();
      draw();
      return;
    }
    if (st.mode !== 'furnish' || !st.room) {
      hideCtxMenu();
      return;
    }
    const hit = hitItem(toWorld(e));
    if (hit) {
      st.select(hit.uid);
      openCtxMenu(e.clientX, e.clientY);
      draw();
    } else {
      hideCtxMenu();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const st = useStore.getState();
    if (e.button !== 0) return; // right-click is context menu only
    hideCtxMenu();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer already released — dragging still works */
    }
    // multi-touch bookkeeping — a second finger turns this into pinch-zoom / two-finger pan
    clearLongPress();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      dragRef.current = null;
      panRef.current = null;
      wallPendingRef.current = null;
      draftPendingRef.current = null;
      if (pointersRef.current.size === 2) startPinch();
      return;
    }
    const p = toWorld(e);

    // 🧱 wall tool takes priority over everything else.
    // Record the intended action now, but only commit it on a clean
    // pointer-up — dragging still pans the view.
    if (st.wallBuild) {
      if (st.wallDraft?.length) {
        wallPendingRef.current = { kind: 'add', p }; // extend / close the chain
      } else {
        // Start from a nearby vertex, else delete a wall under the cursor,
        // else start a fresh chain. The raw click goes to the store, which
        // re-snaps it and detects which wall the chain is drawn from.
        const snap = snapNearestVertex(p, st);
        if (snap) {
          wallPendingRef.current = { kind: 'add', p };
        } else {
          const wid = hitBuiltWall(p);
          wallPendingRef.current = wid ? { kind: 'delete', id: wid } : { kind: 'add', p };
        }
      }
      panRef.current = { sx: e.clientX, sy: e.clientY, px: viewRef.current.panX, py: viewRef.current.panY, moved: false };
      draw();
      return;
    }

    if (st.mode === 'draw' && !st.room) {
      // commit on a clean tap-up so a pinch (second finger) can cancel it
      draftPendingRef.current = { p, x: e.clientX, y: e.clientY };
      draw();
      return;
    }

    if (st.edgeEdit && st.room) {
      const idx = hitEdge(p);
      if (idx >= 0) {
        st.cycleEdge(idx);
        draw();
        return;
      }
    }

    const hit = hitItem(p);
    if (hit) {
      st.select(hit.uid);
      dragRef.current = { uid: hit.uid, ox: p.x - hit.x, oy: p.y - hit.y, moved: false };
      if (e.pointerType !== 'mouse') armLongPress(e.clientX, e.clientY);
      draw();
      return;
    }

    // empty space: pan on drag, deselect on clean click
    panRef.current = { sx: e.clientX, sy: e.clientY, px: viewRef.current.panX, py: viewRef.current.panY, moved: false };
    st.select(null);
    draw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = useStore.getState();
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    // two fingers down: zoom / pan the view and ignore everything else
    if (pinchRef.current) {
      if (pointersRef.current.size >= 2) applyPinch();
      return;
    }
    // a moving press is a drag, not a long-press / corner tap
    const lp = longPressRef.current;
    if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) clearLongPress();
    const dp = draftPendingRef.current;
    if (dp && Math.hypot(e.clientX - dp.x, e.clientY - dp.y) > 10) draftPendingRef.current = null;

    const p = toWorld(e);
    cursorRef.current = p;

    if (st.wallBuild) {
      // drag pans the view; a clean hover highlights removable walls
      if (panRef.current) {
        const dx = e.clientX - panRef.current.sx;
        const dy = e.clientY - panRef.current.sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) panRef.current.moved = true;
        if (panRef.current.moved) {
          viewRef.current.panX = panRef.current.px + dx;
          viewRef.current.panY = panRef.current.py + dy;
          draw();
          return;
        }
      }
      // hover highlight on built walls while no chain is in progress
      const prev = hoverWallRef.current;
      hoverWallRef.current = st.wallDraft?.length ? null : hitBuiltWall(p);
      if (prev !== hoverWallRef.current || st.wallDraft?.length) draw();
      return;
    }

    if (st.mode === 'draw' && !st.room) {
      hoverEdgeRef.current = -1;
      draw();
      return;
    }

    if (dragRef.current) {
      dragRef.current.moved = true;
      st.tryMoveRaw(dragRef.current.uid, p.x - dragRef.current.ox, p.y - dragRef.current.oy);
      draw();
      return;
    }

    if (panRef.current) {
      const dx = e.clientX - panRef.current.sx;
      const dy = e.clientY - panRef.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) panRef.current.moved = true;
      viewRef.current.panX = panRef.current.px + dx;
      viewRef.current.panY = panRef.current.py + dy;
      draw();
      return;
    }

    // hover feedback for edge editing
    const prev = hoverEdgeRef.current;
    hoverEdgeRef.current = st.edgeEdit && st.room ? hitEdge(p) : -1;
    if (prev !== hoverEdgeRef.current) draw();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const st = useStore.getState();
    clearLongPress();
    pointersRef.current.delete(e.pointerId);
    if (pinchRef.current) {
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (pointersRef.current.size > 0) return; // remaining finger keeps its gesture
    }
    if (dragRef.current && !dragRef.current.moved) {
      // plain click — selection already handled on down
    }
    // 🧱 commit the wall action only if the pointer didn't pan/drag
    const pending = wallPendingRef.current;
    if (pending && !panRef.current?.moved) {
      if (pending.kind === 'add') st.addWallPoint(pending.p);
      else {
        st.removeWall(pending.id);
        useStore.getState().toastMsg('Wall removed.');
      }
      draw();
    }
    wallPendingRef.current = null;
    dragRef.current = null;
    panRef.current = null;
    // ✏️ draw mode: place the corner on a clean tap (no drag / pinch happened)
    const dp = draftPendingRef.current;
    draftPendingRef.current = null;
    if (dp && st.mode === 'draw' && !st.room) {
      st.addDraftPoint(dp.p);
      draw();
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    clearLongPress();
    pointersRef.current.delete(e.pointerId);
    if (pinchRef.current && pointersRef.current.size < 2) pinchRef.current = null;
    wallPendingRef.current = null;
    draftPendingRef.current = null;
    dragRef.current = null;
    panRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const st = useStore.getState();
    if (!st.room && !st.draft && !st.wallBuild) return;
    e.preventDefault();
    const cv = canvas2DRef.current!;
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const before = toWorld(e as any);
    const factor = Math.exp(-e.deltaY * 0.0012);
    const view = viewRef.current;
    view.zoom = Math.min(4.5, Math.max(0.35, view.zoom * factor));
    // keep the cursor's world point stationary
    const cw = size.w;
    const ch = size.h;
    const fit = currentFit(cw, ch, st);
    const scale = fit.scale * view.zoom;
    view.panX = px - cw / 2 - (before.x - fit.cx) * scale;
    view.panY = py - ch / 2 + (before.y - fit.cy) * scale;
    draw();
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useStore.getState();
      if (e.key === 'Enter' && st.draft) {
        st.closeDraft();
        draw();
      } else if (e.key === 'Escape') {
        hideCtxMenu();
        if (st.wallDraft?.length) st.finishWallDraft();
        else if (st.wallBuild) st.setWallBuild(false);
        else if (st.draft) st.cancelDraft();
        else if (st.upgradeOpen) st.setUpgradeOpen(false);
        else if (st.edgeEdit) st.setEdgeEdit(false);
        else st.select(null);
        draw();
      } else if (objectHotkey(e)) {
        // arrows / WASD nudge, R rotates, Del removes — shared with the 3D view
        draw();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draw]);

  const st = useStore();
  const cursorStyle = st.wallBuild
    ? 'crosshair'
    : st.mode === 'draw' && !st.room
      ? 'crosshair'
      : dragRef.current
        ? 'grabbing'
        : 'grab';

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvas2DRef}
        style={{ cursor: cursorStyle }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          cursorRef.current = null;
          dragRef.current = null;
          panRef.current = null;
          wallPendingRef.current = null;
          draftPendingRef.current = null;
          clearLongPress();
          pointersRef.current.clear();
          pinchRef.current = null;
          draw();
        }}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
      />
      {/* selection toolbar — positioned imperatively inside draw() */}
      <div className="sel-toolbar" ref={toolbarRef} style={{ display: 'none' }}>
        <button data-act="rotate" title="Rotate (R)" onClick={() => { useStore.getState().rotateSelected(); draw(); }}>
          Rotate 90°
        </button>
        <button data-act="dup" title="Duplicate" onClick={() => { useStore.getState().duplicateSelected(); draw(); }}>
          Duplicate
        </button>
        <button data-act="del" className="danger" title="Delete (Del)" onClick={() => { useStore.getState().removeSelected(); draw(); }}>
          Delete
        </button>
      </div>
      {/* right-click context menu */}
      <div className="ctx-menu" ref={ctxRef} style={{ display: 'none' }}>
        <button data-act="rotate" onClick={() => { hideCtxMenu(); useStore.getState().rotateSelected(); draw(); }}>
          Rotate 90°
        </button>
        <button data-act="dup" onClick={() => { hideCtxMenu(); useStore.getState().duplicateSelected(); draw(); }}>
          Duplicate
        </button>
        <button data-act="del" className="danger" onClick={() => { hideCtxMenu(); useStore.getState().removeSelected(); draw(); }}>
          Delete
        </button>
      </div>
      {st.wallBuild && (
        <div className="canvas-hint accent">
          🧱 Click the ground to lay walls — they align to the wall you start from · <b>click a wall</b> to remove it · <b>Esc</b>/right-click finishes the chain
        </div>
      )}
      {st.mode === 'draw' && st.room && !st.edgeEdit && !st.wallBuild && (
        <div className="canvas-hint">✅ Room closed — use <b>Furnish</b> or edit walls with <b>Edit openings</b></div>
      )}
      {st.edgeEdit && (
        <div className="canvas-hint accent">
          Click a wall to cycle: wall → window → door. Press <b>Esc</b> to exit.
        </div>
      )}
      {st.mode === 'furnish' && !st.edgeEdit && !st.wallBuild && st.items.length === 0 && (
        <div className="canvas-hint">
          Pick items from the library on the left, or hit <b>AI Fill</b> to furnish automatically.
        </div>
      )}
    </div>
  );
}
