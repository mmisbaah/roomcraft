// Procedural low-poly furniture meshes built from item specs.
// Everything is generated in code — no external 3D assets required.
//
// Mount conventions (group origin at the mount anchor):
//   floor    → origin on the floor; front faces +z, backrest at −z
//   surface  → origin on the support top; piece grows upward
//   wall     → origin at anchor height; wall face at +z, room side −z
//   ceiling  → origin at CEIL_H − drop; the cord/chain runs up to the ceiling

import { useMemo, useRef } from 'react';
import { CanvasTexture, Plane, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import type { FurnItem, PlacedItem } from '../types';
import { ITEM_INDEX } from '../data/items';
import { supportAt } from '../logic/placement';
import { useStore } from '../store';

/** Ceiling height of the 3D room (kept in sync with Scene3D's walls). */
export const CEIL_H = 2.7;

const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0);

/** Deterministic pseudo-random in [0, 1) — stable across re-renders. */
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function Mat({
  color,
  rough = 0.72,
  metal = 0.04,
  emissive,
  intensity = 1,
}: {
  color: string;
  rough?: number;
  metal?: number;
  emissive?: string;
  intensity?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={metal}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissive ? intensity : 0}
    />
  );
}

function box(
  key: string,
  args: [number, number, number],
  pos: [number, number, number],
  color: string,
  rot?: [number, number, number],
  rough?: number,
) {
  return (
    <mesh key={key} position={pos} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={args} />
      <Mat color={color} rough={rough} />
    </mesh>
  );
}

function cyl(
  key: string,
  args: [number, number, number, number?],
  pos: [number, number, number],
  color: string,
  rot?: [number, number, number],
  open?: boolean,
) {
  return (
    <mesh key={key} position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[args[0], args[1], args[2], args[3] ?? 16, 1, open ?? false]} />
      <Mat color={color} />
    </mesh>
  );
}

function sph(
  key: string,
  r: number,
  pos: [number, number, number],
  color: string,
  scale?: [number, number, number],
  emissive?: string,
) {
  return (
    <mesh key={key} position={pos} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[r, 12, 10]} />
      <Mat color={color} rough={0.8} emissive={emissive} />
    </mesh>
  );
}

/** Box with full material control (chrome, brass, glossy porcelain…). */
function metalBox(
  key: string,
  args: [number, number, number],
  pos: [number, number, number],
  color: string,
  metal = 0.65,
  rough = 0.28,
  rot?: [number, number, number],
) {
  return (
    <mesh key={key} position={pos} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={args} />
      <Mat color={color} rough={rough} metal={metal} />
    </mesh>
  );
}

/** Cylinder with full material control (chrome posts, rails, fixtures…). */
function metalCyl(
  key: string,
  args: [number, number, number, number?],
  pos: [number, number, number],
  color: string,
  metal = 0.65,
  rough = 0.28,
  rot?: [number, number, number],
) {
  return (
    <mesh key={key} position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[args[0], args[1], args[2], args[3] ?? 12]} />
      <Mat color={color} rough={rough} metal={metal} />
    </mesh>
  );
}

function glowBox(
  key: string,
  args: [number, number, number],
  pos: [number, number, number],
  color: string,
  intensity = 1.4,
  rot?: [number, number, number],
) {
  return (
    <mesh key={key} position={pos} rotation={rot}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} />
    </mesh>
  );
}

function glowSphere(key: string, r: number, pos: [number, number, number], color: string, scale?: [number, number, number]) {
  return (
    <mesh key={key} position={pos} scale={scale}>
      <sphereGeometry args={[r, 12, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
    </mesh>
  );
}

// --------------------------------------------------------------------- sofa
function Sofa({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const legs = sp.legs !== false;
  const legH = legs ? 0.12 : 0;
  const baseH = 0.3;
  const seatTop = legH + baseH;
  const back = sp.back ?? 0.62;
  const arms = sp.arms !== false;
  const armW = 0.16;
  const seats = Math.max(2, Math.min(5, sp.seats ?? Math.round(w / 0.7)));
  const chaise = !!sp.chaise;
  const bodyD = chaise ? Math.max(0.7, d - 0.85) : d;
  const bodyZ = -d / 2 + bodyD / 2;
  const c = f.color;
  const a = f.accent;

  const parts: React.ReactNode[] = [];
  parts.push(box('body', [w, baseH, bodyD], [0, legH + baseH / 2, bodyZ], c));
  if (chaise) {
    parts.push(
      box('chaise', [Math.min(1.0, w * 0.4), baseH, d - bodyD], [
        w / 2 - Math.min(1.0, w * 0.4) / 2,
        legH + baseH / 2,
        d / 2 - (d - bodyD) / 2,
      ], c),
    );
  }
  if (legs) {
    const inset = 0.14;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      parts.push(
        box(`leg${sx}${sz}`, [0.07, legH, 0.07], [
          sx * (w / 2 - inset),
          legH / 2,
          bodyZ + sz * (bodyD / 2 - inset),
        ], a),
      );
    }
  }
  // seat cushions
  const innerW = arms ? w - armW * 2 : w;
  const cw = innerW / seats;
  for (let i = 0; i < seats; i++) {
    const x = -w / 2 + (arms ? armW : 0) + cw * (i + 0.5);
    parts.push(
      box(`cus${i}`, [cw - 0.03, 0.14, bodyD - 0.16], [x, seatTop + 0.07, bodyZ + 0.04], a),
    );
  }
  // backrest (local −z = back)
  const top = seatTop + back;
  const bot = seatTop - 0.18;
  parts.push(box('back', [w, top - bot, 0.17], [0, (top + bot) / 2, -d / 2 + 0.085], c));
  if (sp.tuft) {
    for (let i = 0; i < seats; i++) {
      const x = -w / 2 + (arms ? armW : 0) + (innerW / seats) * (i + 0.5);
      parts.push(
        <mesh key={`t${i}`} position={[x, seatTop + back * 0.55, -d / 2 + 0.175]} castShadow>
          <sphereGeometry args={[0.05, 10, 8]} />
          <Mat color={a} />
        </mesh>,
      );
    }
  }
  if (arms) {
    const armH = seatTop + 0.16 - legH;
    for (const s of [-1, 1]) {
      parts.push(
        box(`arm${s}`, [armW, armH, bodyD], [s * (w / 2 - armW / 2), legH + armH / 2, bodyZ], c),
      );
    }
  }
  return <group>{parts}</group>;
}

// --------------------------------------------------------------------- chair
function Chair({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const seatH = sp.seatH ?? 0.45;
  const c = f.color;
  const a = f.accent;
  const stool = !!sp.stool;
  const legs = sp.legs !== false;
  const parts: React.ReactNode[] = [];

  parts.push(box('seat', [w, 0.08, d], [0, seatH, 0], c));
  parts.push(box('cushion', [w - 0.05, 0.045, d - 0.05], [0, seatH + 0.06, 0], a));
  if (legs) {
    const inset = 0.05;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      if (sp.wheels) {
        parts.push(
          <mesh key={`w${sx}${sz}`} position={[sx * (w / 2 - inset), 0.035, sz * (d / 2 - inset)]} castShadow>
            <sphereGeometry args={[0.035, 10, 8]} />
            <Mat color="#22262e" />
          </mesh>,
        );
        parts.push(box(`leg${sx}${sz}`, [0.03, seatH - 0.09, 0.03], [sx * (w / 2 - inset), (seatH - 0.05) / 2 + 0.05, sz * (d / 2 - inset)], a));
      } else if (sp.rocker) {
        parts.push(box(`leg${sx}${sz}`, [0.045, seatH, 0.045], [sx * (w / 2 - inset), seatH / 2, sz * (d / 2 - inset)], a));
      } else {
        parts.push(box(`leg${sx}${sz}`, [0.04, seatH - 0.04, 0.04], [sx * (w / 2 - inset), (seatH - 0.04) / 2, sz * (d / 2 - inset)], a));
      }
    }
    if (sp.rocker) {
      for (const s of [-1, 1]) {
        parts.push(
          <mesh key={`rk${s}`} position={[s * (w / 2 - 0.03), 0.03, 0]} rotation={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.04, 0.05, d * 0.95]} />
            <Mat color={a} />
          </mesh>,
        );
      }
    }
  } else {
    // solid plinth base (ottomans, poufs, chaises)
    parts.push(box('base', [w - 0.02, seatH, d - 0.02], [0, seatH / 2, 0], c));
  }
  if (!stool) {
    const backH = sp.back ?? 0.44;
    const tilt = -(sp.recline ?? 0.07);
    parts.push(
      <mesh
        key="back"
        position={[0, seatH + 0.04 + Math.cos(tilt) * (backH / 2), -d / 2 + 0.03 - Math.sin(tilt) * (backH / 2)]}
        rotation={[tilt, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w * 0.96, backH, 0.055]} />
        <Mat color={c} />
      </mesh>,
    );
  }
  if (sp.arms) {
    const armH = 0.22;
    for (const s of [-1, 1]) {
      parts.push(box(`arm${s}`, [0.05, armH, d * 0.85], [s * (w / 2 - 0.025), seatH + 0.05 + armH / 2, 0.02], a));
    }
  }
  return <group>{parts}</group>;
}

// ---------------------------------------------------------------------- bed
function Bed({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const c = f.color;
  const a = f.accent;
  const parts: React.ReactNode[] = [];

  if (sp.murphy) {
    // folded Murphy bed reads as a tall cabinet (front = +z)
    const h = f.h || 2;
    parts.push(box('cab', [w, h, d], [0, h / 2, 0], c));
    const doorW = w / 2 - 0.03;
    for (const s of [-1, 1]) {
      parts.push(box(`panel${s}`, [doorW - 0.04, h - 0.16, 0.02], [s * (doorW / 2 + 0.02), h / 2, d / 2 + 0.01], a));
      parts.push(box(`hdl${s}`, [0.03, 0.22, 0.03], [s * 0.08, h / 2, d / 2 + 0.035], a));
    }
    parts.push(box('top', [w + 0.04, 0.05, d + 0.04], [0, h + 0.025, 0], a));
    return <group>{parts}</group>;
  }

  const frameH = sp.storage ? 0.32 : 0.22;
  const head = sp.head ?? 0.9;
  parts.push(box('frame', [w, frameH, d], [0, frameH / 2, 0], c));
  parts.push(box('mattress', [w - 0.07, 0.21, d - 0.1], [0, frameH + 0.105, -0.02], '#f6f3ec'));
  if (sp.storage) {
    for (const s of [-1, 1]) {
      parts.push(box(`drawer${s}`, [w / 2 - 0.06, 0.16, 0.02], [s * (w / 4), frameH * 0.5, d / 2 + 0.01], a));
    }
  }
  const headTh = sp.uphol ? 0.14 : 0.09;
  parts.push(
    box('headboard', [w + 0.06, head, headTh], [0, head / 2, -d / 2 - headTh / 2], sp.metal ? a : c),
  );
  if (sp.tuft && sp.uphol) {
    for (let i = 0; i < 4; i++) {
      parts.push(sph(`ht${i}`, 0.045, [(-1.5 + i) * (w / 5), head * 0.6, -d / 2 - headTh - 0.01], a));
    }
  }
  if (sp.sleigh) {
    // rolled foot board
    const footH = 0.55;
    parts.push(box('foot', [w + 0.06, footH, 0.09], [0, footH / 2, d / 2 + 0.045], c));
    parts.push(cyl('footroll', [0.06, 0.06, w + 0.06, 14], [0, footH, d / 2 + 0.045], c, [0, 0, Math.PI / 2]));
    parts.push(cyl('headroll', [0.07, 0.07, w + 0.06, 14], [0, head, -d / 2 - headTh / 2], c, [0, 0, Math.PI / 2]));
  }
  // pillows
  const nP = w >= 1.5 ? 2 : 1;
  for (let i = 0; i < nP; i++) {
    const x = nP === 1 ? 0 : -w * 0.24 + i * w * 0.48;
    parts.push(
      box(`pillow${i}`, [Math.min(0.6, w / nP - 0.08), 0.13, 0.34], [x, frameH + 0.21 + 0.065, -d / 2 + 0.32], '#ffffff', [-0.18, 0, 0]),
    );
  }
  // throw blanket
  parts.push(box('blanket', [w - 0.05, 0.06, d * 0.5], [0, frameH + 0.21 + 0.03, d / 2 - d * 0.25 - 0.04], a));
  if (sp.canopy) {
    const postH = 2.05;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      parts.push(
        box(`cp${sx}${sz}`, [0.07, postH, 0.07], [sx * (w / 2 - 0.035), postH / 2, sz * (d / 2 - 0.035)], c),
      );
    }
    for (const s of [-1, 1]) {
      parts.push(box(`crx${s}`, [w, 0.06, 0.06], [0, postH - 0.03, s * (d / 2 - 0.035)], c));
      parts.push(box(`crz${s}`, [0.06, 0.06, d], [s * (w / 2 - 0.035), postH - 0.03, 0], c));
    }
  }
  return <group>{parts}</group>;
}

// --------------------------------------------------------------------- table
function Table({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const h = f.h || sp.h || 0.75;
  const c = sp.glass ? '#cfe8f0' : f.color;
  const a = f.accent;
  const parts: React.ReactNode[] = [];

  if (sp.round) {
    parts.push(cyl('top', [w / 2, w / 2, 0.05, 28], [0, h - 0.025, 0], c, undefined, sp.glass));
    if (sp.legs === 'pedestal') {
      parts.push(cyl('pod', [0.06, 0.07, h - 0.05, 14], [0, (h - 0.05) / 2, 0], a));
      parts.push(cyl('base', [w / 4, w / 4, 0.03, 24], [0, 0.015, 0], a));
    }
  } else {
    parts.push(box('top', [w, 0.05, d], [0, h - 0.025, 0], c, undefined, sp.glass ? 0.15 : 0.72));
    const legStyle = sp.legs ?? 'block';
    const inset = 0.09;
    const legH = h - 0.05;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const x = sx * (w / 2 - inset);
      const z = sz * (d / 2 - inset);
      if (legStyle === 'taper') {
        parts.push(
          <mesh key={`L${sx}${sz}`} position={[x, legH / 2, z]} castShadow receiveShadow>
            <cylinderGeometry args={[0.024, 0.038, legH, 12]} />
            <Mat color={a} />
          </mesh>,
        );
      } else if (legStyle === 'hairpin') {
        parts.push(box(`L${sx}${sz}`, [0.022, legH, 0.022], [x, legH / 2, z], a));
      } else if (legStyle === 'standing') {
        parts.push(box(`L${sx}${sz}`, [0.05, legH, 0.05], [x, legH / 2, z], a));
        if (sx === -1) parts.push(box(`beam${sz}`, [w - 0.2, 0.05, 0.05], [0, legH * 0.5, sz * (d / 2 - inset)], a));
      } else {
        parts.push(box(`L${sx}${sz}`, [0.065, legH, 0.065], [x, legH / 2, z], a));
      }
    }
    if (legStyle === 'cframe') {
      parts.push(box('cf1', [0.05, h, 0.05], [-w / 2 + 0.04, h / 2, 0], a));
      parts.push(box('cf2', [w - 0.1, 0.05, 0.05], [0, 0.03, 0], a));
    }
    if (sp.apron) {
      parts.push(box('apron', [w - 0.16, 0.09, d - 0.16], [0, h - 0.1, 0], a));
    }
  }
  return <group>{parts}</group>;
}

// ------------------------------------------------------------------ casegood
const LEGGY = ['credenza', 'sideboard', 'buffet', 'nightstand', 'media'];
const OPEN = ['bookcase', 'shelving'];

function Casegood({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const h = f.h || 1;
  const c = f.color;
  const a = f.accent;
  const parts: React.ReactNode[] = [];
  const open = !!sp.open || OPEN.includes(f.kind);
  const legH = !open && h <= 1.35 && LEGGY.includes(f.kind) ? 0.1 : 0;
  const bodyH = h - legH;
  const front = d / 2; // doors/drawers face local +z

  if (open) {
    // ladder bookcase / shelving unit: sides, caps, back, shelves
    const t = 0.03;
    parts.push(box('L', [t, h, d], [-w / 2 + t / 2, h / 2, 0], c));
    parts.push(box('R', [t, h, d], [w / 2 - t / 2, h / 2, 0], c));
    parts.push(box('T', [w, t, d], [0, h - t / 2, 0], c));
    parts.push(box('B', [w, t, d], [0, t / 2, 0], c));
    parts.push(box('back', [w - t * 2, h - t * 2, 0.015], [0, h / 2, -d / 2 + 0.01], a));
    const n = sp.shelves ?? Math.max(3, Math.round(h / 0.36));
    for (let i = 1; i < n; i++) {
      const y = (h / n) * i;
      parts.push(box(`sh${i}`, [w - t * 2, 0.025, d - 0.04], [0, y, -0.01], c));
      // a few book blocks so shelves aren't empty
      if (i % 2 === 1) {
        const bw = (w - 0.2) * (0.3 + rnd(i) * 0.3);
        parts.push(box(`bk${i}`, [bw, 0.19, 0.16], [-w / 4 + rnd(i + 5) * 0.2, y + 0.11, -d / 2 + 0.13], ['#a26769', '#45608a', '#a3b18a', '#d9a441'][i % 4]));
      }
    }
    return <group>{parts}</group>;
  }

  // carcass
  if (legH > 0) {
    const inset = 0.07;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      parts.push(box(`lg${sx}${sz}`, [0.045, legH, 0.045], [sx * (w / 2 - inset), legH / 2, sz * (d / 2 - inset)], a));
    }
  }
  parts.push(box('body', [w, bodyH, d], [0, legH + bodyH / 2, 0], c));
  parts.push(box('top', [w + 0.03, 0.03, d + 0.03], [0, legH + bodyH + 0.015, 0], a));

  const drawers = sp.drawers ?? 0;
  const doors = sp.doors ?? 0;
  if (drawers > 0) {
    const n = Math.min(drawers, 8);
    const gap = 0.02;
    const dh = (bodyH - 0.1) / n;
    const perRow = drawers > n ? Math.ceil(drawers / n) : 1;
    let idx = 0;
    for (let r = 0; r < n; r++) {
      const y = legH + 0.05 + dh * (r + 0.5);
      for (let cc = 0; cc < perRow; cc++, idx++) {
        const dw = (w - 0.1) / perRow - gap;
        const x = -(w - 0.1) / 2 + (dw + gap) * (cc + 0.5) + (perRow === 1 ? 0 : 0);
        parts.push(box(`dr${idx}`, [dw, dh - gap, 0.02], [x + (perRow === 1 ? 0 : 0), y, front + 0.01], a));
        parts.push(
          <mesh key={`kn${idx}`} position={[x, y, front + 0.035]} castShadow>
            <sphereGeometry args={[0.018, 8, 6]} />
            <Mat color="#3d405b" metal={0.7} rough={0.35} />
          </mesh>,
        );
      }
    }
  } else if (doors > 0) {
    const gap = 0.02;
    const dw = (w - 0.08) / doors - gap;
    for (let i = 0; i < doors; i++) {
      const x = -(w - 0.08) / 2 + (dw + gap) * (i + 0.5);
      const gh = sp.glass ? '#cfe8f0' : a;
      parts.push(box(`dr${i}`, [dw, bodyH - 0.1, 0.02], [x, legH + bodyH / 2, front + 0.01], gh));
      if (!sp.glass) {
        parts.push(box(`hd${i}`, [0.025, 0.16, 0.03], [x + dw / 2 - 0.05, legH + bodyH / 2, front + 0.035], '#3d405b'));
      }
      if (sp.shelves) {
        // hint of interior shelving behind glass
        for (let s = 1; s <= (sp.shelves ?? 0); s++) {
          parts.push(box(`is${i}${s}`, [dw - 0.04, 0.02, 0.1], [x, legH + (bodyH / (sp.shelves + 1)) * s, front - 0.05], c));
        }
      }
    }
  }
  return <group>{parts}</group>;
}

// ---------------------------------------------------------------------- rug
function Rug({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const c = f.color;
  const a = f.accent;
  if (sp.round) {
    return (
      <group>
        <mesh position={[0, 0.008, 0]} receiveShadow>
          <cylinderGeometry args={[w / 2 + 0.06, w / 2 + 0.06, 0.016, 40]} />
          <Mat color={a} rough={0.95} />
        </mesh>
        <mesh position={[0, 0.016, 0]} receiveShadow>
          <cylinderGeometry args={[w / 2, w / 2, 0.016, 40]} />
          <Mat color={c} rough={0.95} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      {sp.border !== false && (
        <mesh position={[0, 0.008, 0]} receiveShadow>
          <boxGeometry args={[w + 0.1, 0.016, d + 0.1]} />
          <Mat color={a} rough={0.95} />
        </mesh>
      )}
      <mesh position={[0, 0.017, 0]} receiveShadow>
        <boxGeometry args={[w, 0.018, d]} />
        <Mat color={c} rough={0.95} />
      </mesh>
      {sp.stripe && (
        <mesh position={[0, 0.027, 0]} receiveShadow>
          <boxGeometry args={[w * 0.98, 0.004, d * 0.35]} />
          <Mat color={a} rough={0.95} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------- lamp
function Lamp({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const h = f.h || sp.h || 1.55;
  const c = f.color;
  const a = f.accent;
  const parts: React.ReactNode[] = [];
  const shade = sp.shade ?? 'drum';
  const poleKind = sp.pole ?? 'single';
  const surface = f.mount === 'surface';

  if (!surface) {
    parts.push(cyl('base', [Math.min(w, d) / 2, Math.min(w, d) / 2 + 0.02, 0.035, 22], [0, 0.018, 0], poleKind === 'tripod' ? a : c));
  } else {
    parts.push(cyl('base', [w / 2, w / 2 + 0.01, 0.02, 20], [0, 0.01, 0], a));
  }

  const shadeY = h - 0.14;
  const shadeX = poleKind === 'arc' ? Math.max(0.55, d - 0.35) : 0;

  if (poleKind === 'arc') {
    const poleH = h * 0.78;
    parts.push(cyl('pole', [0.022, 0.026, poleH, 12], [0, poleH / 2, 0], c));
    parts.push(box('arm', [shadeX + 0.1, 0.035, 0.035], [shadeX / 2, poleH, 0], c));
    parts.push(
      <mesh key="drop" position={[shadeX, poleH - 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 8]} />
        <Mat color={c} />
      </mesh>,
    );
  } else if (poleKind === 'tripod') {
    const poleH = h - 0.42;
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      parts.push(
        <mesh
          key={`tl${i}`}
          position={[Math.cos(ang) * 0.12, poleH / 2, Math.sin(ang) * 0.12]}
          rotation={[Math.sin(ang) * 0.14, 0, -Math.cos(ang) * 0.14]}
          castShadow
        >
          <boxGeometry args={[0.035, poleH, 0.035]} />
          <Mat color={a} />
        </mesh>,
      );
    }
  } else {
    const poleH = h - 0.3;
    if (shade === 'tower') {
      parts.push(box('tower', [w * 0.6, h, d * 0.6], [0, h / 2, 0], c));
      parts.push(box('glow', [w * 0.5, h * 0.85, d * 0.5 + 0.005], [0, h / 2, 0], a));
      return <group>{parts}</group>;
    }
    parts.push(cyl('pole', [0.02, 0.024, poleH, 12], [0, poleH / 2, 0], a));
  }

  const sx = poleKind === 'arc' ? shadeX : 0;
  if (shade === 'sphere' || shade === 'dome') {
    parts.push(
      <mesh key="shade" position={[sx, shadeY, 0]} castShadow>
        <sphereGeometry args={[0.17, 20, 14, 0, Math.PI * 2, 0, shade === 'dome' ? Math.PI * 0.62 : Math.PI]} />
        <meshStandardMaterial color={a} side={2} roughness={0.6} />
      </mesh>,
    );
  } else if (shade === 'cone') {
    parts.push(
      <mesh key="shade" position={[sx, shadeY, 0]} castShadow>
        <coneGeometry args={[0.19, 0.3, 20, 1, true]} />
        <meshStandardMaterial color={a} side={2} roughness={0.55} />
      </mesh>,
    );
  } else if (shade === 'cage') {
    parts.push(
      <mesh key="shade" position={[sx, shadeY, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.17, 0.3, 10, 1, true]} />
        <meshStandardMaterial color={a} side={2} roughness={0.5} metalness={0.6} />
      </mesh>,
    );
  } else if (shade === 'uplight') {
    parts.push(
      <mesh key="shade" position={[sx, shadeY - 0.05, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.17, 0.26, 20, 1, true]} />
        <meshStandardMaterial color={a} side={2} roughness={0.6} />
      </mesh>,
    );
    parts.push(glowSphere('glow', 0.09, [sx, shadeY + 0.02, 0], '#fff3c9'));
    parts.push(<pointLight key="pl" position={[sx, shadeY + 0.1, 0]} intensity={0.5} distance={4} color="#ffe9bd" castShadow={false} />);
    return <group>{parts}</group>;
  } else {
    parts.push(
      <mesh key="shade" position={[sx, shadeY, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.16, 0.27, 20, 1, true]} />
        <meshStandardMaterial color={a} side={2} roughness={0.7} />
      </mesh>,
    );
  }
  // warm bulb glow
  parts.push(glowSphere('bulb', 0.06, [sx, shadeY - 0.02, 0], '#fff3c9'));
  parts.push(
    <pointLight key="pl" position={[sx, shadeY - 0.1, 0]} intensity={0.55} distance={4.5} color="#ffe9bd" castShadow={false} />,
  );

  return <group>{parts}</group>;
}

// ---------------------------------------------------------- ceiling fixtures
// Origin at CEIL_H − drop; the cord/stem runs up to the ceiling (+f.h).
function CeilingLight({ f }: { f: FurnItem }) {
  const { w } = f;
  const sp = f.spec;
  const drop = f.h || 0.4;
  const c = f.color;
  const a = f.accent;
  const parts: React.ReactNode[] = [];
  const kind = f.kind;

  const stem = (topR = 0.012, from = 0.12) => {
    const len = Math.max(0.02, drop - from);
    parts.push(cyl('stem', [topR, topR, len, 8], [0, from + len / 2, 0], '#3d405b'));
    parts.push(cyl('canopy', [0.06, 0.05, 0.03, 16], [0, drop - 0.015, 0], c));
  };

  if (kind === 'flush' || kind === 'recessed') {
    // hugs the ceiling
    if (kind === 'recessed') {
      parts.push(cyl('ring', [w / 2, w / 2, 0.025, 24], [0, 0.01, 0], c));
      parts.push(glowSphere('glow', w / 2 - 0.02, [0, -0.01, 0], '#fff3c9', [1, 0.4, 1]));
      parts.push(<pointLight key="pl" position={[0, -0.1, 0]} intensity={0.4} distance={4} color="#ffe9bd" castShadow={false} />);
    } else {
      const rh = sp.shade === 'square' || sp.shade === 'globe' ? 0.1 : 0.13;
      if (sp.shade === 'globe') {
        parts.push(sph('dome', w / 2, [0, -0.05, 0], '#f3efe4', [1, 0.8, 1]));
      } else {
        parts.push(cyl('drum', [w / 2, w / 2, rh, 24], [0, -rh / 2 + 0.02, 0], sp.shade === 'square' ? c : a));
        parts.push(cyl('trim', [w / 2 + 0.01, w / 2 + 0.01, 0.02, 24], [0, 0.015, 0], c));
      }
      parts.push(glowSphere('diff', w / 2 - 0.04, [0, -rh + 0.03, 0], '#fff6dd', [1, 0.5, 1]));
      parts.push(<pointLight key="pl" position={[0, -0.2, 0]} intensity={0.55} distance={5} color="#ffe9bd" castShadow={false} />);
    }
    return <group>{parts}</group>;
  }

  if (kind === 'track') {
    parts.push(box('rail', [w, 0.05, 0.05], [0, -0.025, 0], '#3d405b'));
    parts.push(box('mount', [0.1, 0.04, 0.1], [0, 0, 0], c));
    const heads = sp.heads ?? 3;
    for (let i = 0; i < heads; i++) {
      const x = -w / 2 + (w / (heads + 1)) * (i + 1);
      parts.push(cyl(`hd${i}`, [0.035, 0.045, 0.14, 10], [x, -0.1, 0], c, [0.5, 0, 0.25]));
      parts.push(glowSphere(`gl${i}`, 0.03, [x + 0.02, -0.16, 0.03], '#fff3c9'));
    }
    parts.push(<pointLight key="pl" position={[0, -0.4, 0]} intensity={0.5} distance={5} color="#ffe9bd" castShadow={false} />);
    return <group>{parts}</group>;
  }

  if (kind === 'fan') {
    stem(0.02, 0.06);
    parts.push(cyl('hub', [0.09, 0.09, 0.09, 16], [0, 0.02, 0], c));
    const blades = sp.blades ?? 5;
    for (let i = 0; i < blades; i++) {
      const ang = (i / blades) * Math.PI * 2;
      parts.push(
        <mesh key={`fb${i}`} position={[Math.cos(ang) * w * 0.3, -0.01, Math.sin(ang) * w * 0.3]} rotation={[0, -ang, 0.06]} castShadow>
          <boxGeometry args={[w * 0.55, 0.015, 0.14]} />
          <Mat color={a} rough={0.6} />
        </mesh>,
      );
    }
    if (sp.light) {
      parts.push(sph('bowl', 0.1, [0, -0.07, 0], '#f6f2e6', [1, 0.7, 1]));
      parts.push(<pointLight key="pl" position={[0, -0.15, 0]} intensity={0.55} distance={5} color="#ffe9bd" castShadow={false} />);
    }
    return <group>{parts}</group>;
  }

  if (kind === 'chandelier') {
    stem(0.015, 0.15);
    const arms = sp.arms ?? 6;
    const crystal = sp.shade === 'crystal';
    parts.push(cyl('body', [0.05, 0.04, 0.16, 12], [0, 0.06, 0], a));
    for (let i = 0; i < arms; i++) {
      const ang = (i / arms) * Math.PI * 2;
      const R = w / 2 - 0.06;
      parts.push(
        <mesh key={`ar${i}`} position={[Math.cos(ang) * R * 0.55, 0.02, Math.sin(ang) * R * 0.55]} rotation={[0, -ang, 0]} castShadow>
          <boxGeometry args={[R, 0.02, 0.02]} />
          <Mat color={a} metal={0.6} rough={0.35} />
        </mesh>,
      );
      const tip: [number, number, number] = [Math.cos(ang) * R, -0.02, Math.sin(ang) * R];
      if (sp.shade === 'ring') {
        // ring frame handled below
        parts.push(glowSphere(`c${i}`, 0.03, [tip[0], 0.0, tip[2]], '#ffe9a8'));
      } else {
        parts.push(cyl(`cup${i}`, [0.05, 0.03, 0.05, 10], [tip[0], 0.02, tip[2]], a));
        parts.push(glowSphere(`c${i}`, 0.032, [tip[0], 0.06, tip[2]], '#ffe9a8'));
      }
      if (crystal) {
        parts.push(
          <mesh key={`cr${i}`} position={[tip[0] * 0.7, -0.12, tip[2] * 0.7]}>
            <octahedronGeometry args={[0.035]} />
            <meshStandardMaterial color="#e8f4fa" roughness={0.1} metalness={0.2} transparent opacity={0.75} />
          </mesh>,
        );
      }
    }
    if (sp.shade === 'ring') {
      parts.push(
        <mesh key="ring" position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[w / 2 - 0.05, 0.02, 10, 40]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={1.1} />
        </mesh>,
      );
    }
    parts.push(<pointLight key="pl" position={[0, -0.1, 0]} intensity={0.7} distance={6} color="#ffe9bd" castShadow={false} />);
    return <group>{parts}</group>;
  }

  // pendant / semi / lantern (default)
  stem(0.012, kind === 'semi' ? 0.05 : 0.14);
  const shadeY = kind === 'semi' ? -0.06 : -0.06;
  const R = w / 2;
  if (sp.shade === 'globe' && sp.globes) {
    const g = sp.globes;
    for (let i = 0; i < g; i++) {
      const x = (i - (g - 1) / 2) * (w * 0.55);
      const dl = Math.max(0.1, drop - 0.1) * (0.7 + rnd(i) * 0.3);
      parts.push(cyl(`cd${i}`, [0.008, 0.008, dl, 6], [x, 0.1 + dl / 2 - 0.1, 0], '#3d405b'));
      parts.push(sph(`g${i}`, 0.1, [x, 0.1 - 0.05 - i * 0.02, 0], '#f3eee2'));
      parts.push(glowSphere(`gl${i}`, 0.07, [x, 0.1 - 0.05 - i * 0.02, 0], '#fff6dd'));
    }
    parts.push(<pointLight key="pl" position={[0, -0.1, 0]} intensity={0.6} distance={5} color="#ffe9bd" castShadow={false} />);
    return <group>{parts}</group>;
  }
  if (sp.shade === 'globe') {
    parts.push(sph('globe', R, [0, shadeY, 0], '#f3eee2'));
    parts.push(glowSphere('glow', R * 0.7, [0, shadeY, 0], '#fff6dd'));
  } else if (sp.shade === 'lantern') {
    parts.push(cyl('lantern', [R, R, 0.3, 20], [0, shadeY - 0.05, 0], '#f2ece0'));
    parts.push(glowSphere('glow', R * 0.7, [0, shadeY - 0.05, 0], '#fff6dd'));
  } else if (sp.shade === 'cage') {
    parts.push(
      <mesh key="cage" position={[0, shadeY - 0.05, 0]} castShadow>
        <cylinderGeometry args={[R, R * 0.6, 0.3, 10, 1, true]} />
        <meshStandardMaterial color={a} side={2} roughness={0.5} metalness={0.6} />
      </mesh>,
    );
    parts.push(glowSphere('bulb', 0.05, [0, shadeY - 0.08, 0], '#ffe9a8'));
  } else {
    // dome / drum shade opening downward
    parts.push(
      <mesh key="shade" position={[0, shadeY, 0]} castShadow>
        <cylinderGeometry args={[R * 0.55, R, 0.22, 24, 1, true]} />
        <meshStandardMaterial color={a} side={2} roughness={0.65} />
      </mesh>,
    );
    parts.push(cyl('cap', [R * 0.55, R * 0.5, 0.03, 20], [0, shadeY + 0.12, 0], c));
    parts.push(glowSphere('bulb', 0.055, [0, shadeY - 0.06, 0], '#ffe9a8'));
  }
  parts.push(<pointLight key="pl" position={[0, shadeY - 0.15, 0]} intensity={0.65} distance={5.5} color="#ffe9bd" castShadow={false} />);
  return <group>{parts}</group>;
}

// ------------------------------------------------------------- wall sconces
// Origin at anchor height; wall face at local +d/2, light reaches out to −z.
function WallLight({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const c = f.color;
  const a = f.accent;
  const parts: React.ReactNode[] = [];
  const back = d / 2;

  if (f.kind === 'vanity') {
    parts.push(box('bar', [w, 0.05, 0.05], [0, 0, back - 0.06], c));
    parts.push(box('stem', [w * 0.9, 0.03, 0.05], [0, 0, back - 0.01], a));
    const heads = sp.heads ?? 2;
    for (let i = 0; i < heads; i++) {
      const x = -w / 2 + (w / (heads + 1)) * (i + 1);
      if (sp.bulbs) {
        parts.push(sph(`b${i}`, 0.045, [x, 0, -0.06], '#fff3d6'));
        parts.push(glowSphere(`g${i}`, 0.03, [x, 0, -0.075], '#ffe9a8'));
      } else {
        parts.push(cyl(`c${i}`, [0.04, 0.05, 0.07, 12], [x, 0, -0.06], a, [Math.PI / 2, 0, 0]));
        parts.push(glowSphere(`g${i}`, 0.028, [x, -0.01, -0.09], '#ffe9a8'));
      }
    }
    parts.push(<pointLight key="pl" position={[0, 0, -0.3]} intensity={0.35} distance={2.5} color="#ffe9bd" castShadow={false} />);
    return <group>{parts}</group>;
  }

  if (f.kind === 'picture') {
    // picture light: arm out from wall + horizontal shade aimed down
    parts.push(box('plate', [0.07, 0.1, 0.02], [0, 0.02, back - 0.01], a));
    parts.push(box('arm', [0.03, 0.03, 0.16], [0, 0.03, back - 0.1], a));
    parts.push(
      <mesh key="shade" position={[0, 0, back - 0.2]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, w, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={c} side={2} roughness={0.5} metalness={0.4} />
      </mesh>,
    );
    parts.push(glowBox('line', [w * 0.9, 0.015, 0.01], [0, -0.03, back - 0.22], '#ffe9a8', 1.8));
    parts.push(<pointLight key="pl" position={[0, -0.1, back - 0.28]} intensity={0.3} distance={2.2} color="#ffe9bd" castShadow={false} />);
    return <group>{parts}</group>;
  }

  if (f.kind === 'swing') {
    parts.push(box('plate', [0.08, 0.14, 0.02], [0, 0, back - 0.01], a));
    const l1 = w * 0.55;
    const l2 = w * 0.5;
    parts.push(box('arm1', [l1, 0.025, 0.025], [l1 / 2, 0, back - 0.12], a, [0, 0, 0]));
    parts.push(box('joint', [0.04, 0.04, 0.04], [l1, 0, back - 0.12], a));
    parts.push(box('arm2', [l2, 0.025, 0.025], [l1 + l2 / 2 - 0.06, 0, back - 0.12 - l2 * 0.5], a, [0, 0.7, 0]));
    const ex = l1 + l2 - 0.1;
    const ez = back - 0.12 - l2 * 0.7;
    parts.push(
      <mesh key="shade" position={[ex, -0.06, ez]} castShadow>
        <coneGeometry args={[0.09, 0.14, 16, 1, true]} />
        <meshStandardMaterial color={c} side={2} roughness={0.55} />
      </mesh>,
    );
    parts.push(glowSphere('bulb', 0.035, [ex, -0.1, ez], '#ffe9a8'));
    parts.push(<pointLight key="pl" position={[ex, -0.15, ez]} intensity={0.35} distance={2.5} color="#ffe9bd" castShadow={false} />);
    return <group>{parts}</group>;
  }

  // sconce (default): backplate, arm, shade
  parts.push(box('plate', [Math.min(0.12, w), 0.14, 0.02], [0, 0, back - 0.01], a));
  if (sp.shade === 'tube') {
    parts.push(cyl('tube', [w / 2, w / 2, d + 0.14, 18], [0, 0, back - 0.1], c, [Math.PI / 2, 0, 0]));
    parts.push(glowBox('g', [w * 0.7, 0.1, 0.01], [0, 0, back - 0.18], '#ffe9a8', 1.6));
  } else if (sp.shade === 'globe') {
    const n = sp.globes ?? 1;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (w * 0.6);
      parts.push(sph(`gl${i}`, 0.07, [x, 0, back - 0.14], '#f3eee2'));
      parts.push(glowSphere(`gh${i}`, 0.05, [x, 0, back - 0.14], '#fff6dd'));
    }
  } else if (sp.shade === 'cone') {
    parts.push(
      <mesh key="shade" position={[0, -0.02, back - 0.16]} rotation={[-Math.PI / 2.4, 0, 0]} castShadow>
        <coneGeometry args={[0.09, 0.14, 16, 1, true]} />
        <meshStandardMaterial color={c} side={2} roughness={0.55} />
      </mesh>,
    );
    parts.push(glowSphere('bulb', 0.03, [0, -0.05, back - 0.19], '#ffe9a8'));
  } else {
    // dome/half-moon shade cupping the wall
    parts.push(
      <mesh key="shade" position={[0, 0, back - 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <sphereGeometry args={[Math.min(0.11, w / 2), 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={c} side={2} roughness={0.6} />
      </mesh>,
    );
    parts.push(glowSphere('bulb', 0.04, [0, -0.03, back - 0.1], '#ffe9a8'));
  }
  parts.push(<pointLight key="pl" position={[0, -0.04, back - 0.22]} intensity={0.35} distance={2.4} color="#ffe9bd" castShadow={false} />);
  return <group>{parts}</group>;
}

// ----------------------------------------------------- architectural lights
function ArchLight({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const c = f.color;
  const g = f.accent; // glow colour
  const back = d / 2;
  const parts: React.ReactNode[] = [];

  if (sp.style === 'step') {
    // recessed niche marker
    parts.push(box('box', [w, f.h * 1.4 || 0.3, d], [0, 0, back - d / 2], c));
    parts.push(glowBox('glow', [w * 0.7, 0.06, 0.02], [0, 0, back - d - 0.005], g, 1.8));
    parts.push(<pointLight key="pl" position={[0, 0, back - d - 0.15]} intensity={0.22} distance={1.8} color={g} castShadow={false} />);
    return <group>{parts}</group>;
  }

  if (sp.style === 'bar') {
    // under-cabinet / shelf bar
    parts.push(box('housing', [w, 0.05, d], [0, 0.02, back - d / 2], c));
    parts.push(glowBox('strip', [w * 0.94, 0.012, d * 0.6], [0, -0.012, back - d / 2], g, 2.2));
    parts.push(<pointLight key="pl" position={[0, -0.14, back - d]} intensity={0.3} distance={2.2} color={g} castShadow={false} />);
    return <group>{parts}</group>;
  }

  // cove / ledstrip channel
  parts.push(box('channel', [w, 0.035, d], [0, 0, back - d / 2], c));
  parts.push(glowBox('line', [w * 0.96, 0.02, d * 0.5], [0, -0.02, back - d / 2], g, 2.4));
  if (f.h > 1) {
    // cove near the ceiling throws light up
    parts.push(glowBox('wash', [w * 0.9, 0.008, 0.16], [0, 0.03, back - d - 0.06], g, 1.4));
    parts.push(<pointLight key="pl" position={[0, 0.2, back - 0.3]} intensity={0.35} distance={3} color={g} castShadow={false} />);
  } else {
    parts.push(<pointLight key="pl" position={[0, 0.05, back - 0.3]} intensity={0.3} distance={2.4} color={g} castShadow={false} />);
  }
  return <group>{parts}</group>;
}

// --------------------------------------------------------------------- plant
function foliageParts(f: FurnItem, y0: number, y1: number, hanging: boolean): React.ReactNode[] {
  const style = f.spec.foliage ?? 'bush';
  const c = f.color;
  const H = Math.max(0.12, y1 - y0);
  const r = f.w / 2;
  const parts: React.ReactNode[] = [];

  switch (style) {
    case 'blade': {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(i) * 0.6;
        const tilt = 0.1 + rnd(i + 9) * 0.28;
        const bh = H * (0.65 + rnd(i + 3) * 0.35);
        parts.push(
          <mesh
            key={`bl${i}`}
            position={[Math.cos(a) * r * 0.22, y0 + bh / 2, Math.sin(a) * r * 0.22]}
            rotation={[Math.sin(a) * tilt, 0, -Math.cos(a) * tilt]}
            castShadow
          >
            <boxGeometry args={[0.035, bh, 0.055]} />
            <Mat color={i % 3 === 0 ? f.accent && c !== f.accent ? c : c : c} rough={0.85} />
          </mesh>,
        );
      }
      break;
    }
    case 'broad': {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(i) * 0.7;
        const lean = 0.35 + rnd(i + 2) * 0.3;
        const bh = H * (0.55 + rnd(i + 4) * 0.45);
        const ex = Math.cos(a) * r * 0.55;
        const ez = Math.sin(a) * r * 0.55;
        parts.push(
          <mesh key={`st${i}`} position={[ex * 0.4, y0 + bh / 2, ez * 0.4]} rotation={[Math.sin(a) * lean * 0.5, 0, -Math.cos(a) * lean * 0.5]} castShadow>
            <cylinderGeometry args={[0.008, 0.012, bh, 6]} />
            <Mat color="#4f7a4a" rough={0.9} />
          </mesh>,
        );
        parts.push(
          <mesh
            key={`lf${i}`}
            position={[ex, y0 + bh, ez]}
            rotation={[0.5 * Math.sin(a), a, -0.4 - rnd(i) * 0.3]}
            scale={[1, 0.22, 0.72]}
            castShadow
          >
            <sphereGeometry args={[0.1 + rnd(i + 7) * 0.06, 10, 8]} />
            <Mat color={c} rough={0.85} />
          </mesh>,
        );
      }
      break;
    }
    case 'palm': {
      const trunkH = H * 0.45;
      parts.push(cyl('trunk', [0.03, 0.045, trunkH, 8], [0, y0 + trunkH / 2, 0], '#7a5c3e'));
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(i) * 0.4;
        const fl = H * (0.5 + rnd(i + 3) * 0.3);
        parts.push(
          <mesh
            key={`fr${i}`}
            position={[Math.cos(a) * fl * 0.32, y0 + trunkH + fl * 0.22, Math.sin(a) * fl * 0.32]}
            rotation={[Math.sin(a) * 0.9, -a, -Math.cos(a) * 0.9 - 0.3]}
            castShadow
          >
            <boxGeometry args={[fl, 0.012, 0.09]} />
            <Mat color={c} rough={0.85} />
          </mesh>,
        );
      }
      break;
    }
    case 'fern': {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(i) * 0.5;
        const fl = H * (0.7 + rnd(i + 6) * 0.4);
        parts.push(
          <mesh
            key={`fn${i}`}
            position={[Math.cos(a) * fl * 0.3, y0 + fl * 0.4, Math.sin(a) * fl * 0.3]}
            rotation={[Math.sin(a) * 1.1, -a, -Math.cos(a) * 1.1]}
            castShadow
          >
            <boxGeometry args={[fl, 0.01, 0.06]} />
            <Mat color={c} rough={0.85} />
          </mesh>,
        );
      }
      break;
    }
    case 'tree': {
      const trunkH = H * 0.5;
      parts.push(cyl('trunk', [0.035, 0.055, trunkH, 8], [0, y0 + trunkH / 2, 0], '#7a5c3e'));
      const cy = y0 + trunkH + H * 0.22;
      const cr = Math.max(0.16, H * 0.3);
      parts.push(sph('cn', cr, [0, cy, 0], c));
      parts.push(sph('c1', cr * 0.7, [cr * 0.6, cy - cr * 0.3, cr * 0.3], c));
      parts.push(sph('c2', cr * 0.65, [-cr * 0.55, cy + cr * 0.2, -cr * 0.35], c));
      parts.push(sph('c3', cr * 0.55, [cr * 0.2, cy + cr * 0.45, -cr * 0.4], c));
      if (f.spec.fruit) {
        for (let i = 0; i < 4; i++) {
          const a = rnd(i) * Math.PI * 2;
          parts.push(sph(`fr${i}`, 0.035, [Math.cos(a) * cr * 0.8, cy + (rnd(i + 3) - 0.4) * cr, Math.sin(a) * cr * 0.8], f.spec.fruit));
        }
      }
      break;
    }
    case 'trailing': {
      const strands = hanging ? 5 : 4;
      for (let i = 0; i < strands; i++) {
        const a = (i / strands) * Math.PI * 2 + rnd(i) * 0.6;
        const px = Math.cos(a) * r * 0.8;
        const pz = Math.sin(a) * r * 0.8;
        const len = hanging ? H * (0.7 + rnd(i + 2) * 0.5) : 0.16;
        const beads = hanging ? 6 : 3;
        for (let k = 0; k < beads; k++) {
          const t = (k + 1) / beads;
          parts.push(
            sph(`t${i}${k}`, 0.028 - t * 0.008, [px * (1 + t * 0.15), y0 - len * t, pz * (1 + t * 0.15)], c),
          );
        }
      }
      // crown
      parts.push(sph('crown', r * 0.8, [0, y0 + 0.03, 0], c, [1, 0.6, 1]));
      break;
    }
    case 'rosette': {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * 0.55;
        parts.push(
          <mesh key={`ro${i}`} position={[Math.cos(a) * rr, y0 + 0.03, Math.sin(a) * rr]} rotation={[0.5 * Math.sin(a), a, -0.5 * Math.cos(a)]} scale={[1, 0.4, 1]} castShadow>
            <sphereGeometry args={[r * 0.42, 8, 6]} />
            <Mat color={i % 2 ? c : f.accent} rough={0.85} />
          </mesh>,
        );
      }
      parts.push(sph('core', r * 0.35, [0, y0 + 0.05, 0], c, [1, 0.6, 1]));
      break;
    }
    case 'cactus': {
      const cols = 3;
      for (let i = 0; i < cols; i++) {
        const a = (i / cols) * Math.PI * 2;
        const px = i === 0 ? 0 : Math.cos(a) * r * 0.4;
        const pz = i === 0 ? 0 : Math.sin(a) * r * 0.4;
        const ch = i === 0 ? H : H * (0.5 + rnd(i) * 0.3);
        parts.push(cyl(`cc${i}`, [0.045, 0.05, ch, 10], [px, y0 + ch / 2, pz], c));
        parts.push(sph(`ct${i}`, 0.045, [px, y0 + ch, pz], c, [1, 0.8, 1]));
        if (i === 0 && rnd(3) > 0.5) {
          parts.push(cyl('arm', [0.03, 0.03, 0.14, 8], [px + 0.08, y0 + ch * 0.6, pz], c, [0, 0, -0.9]));
        }
      }
      break;
    }
    default: {
      // bush / zz / jade / polka etc: clustered spheres
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(i) * 0.8;
        const rr = r * (0.3 + rnd(i + 5) * 0.45);
        const sy = y0 + H * (0.35 + rnd(i + 8) * 0.55);
        parts.push(
          sph(`b${i}`, Math.max(0.07, H * 0.3 * (0.7 + rnd(i + 1) * 0.5)), [Math.cos(a) * rr, sy, Math.sin(a) * rr], c),
        );
      }
      parts.push(sph('core', Math.max(0.08, H * 0.32), [0, y0 + H * 0.5, 0], c));
      break;
    }
  }
  return parts;
}

function Plant({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const pot = f.accent;
  const parts: React.ReactNode[] = [];
  const potH = Math.min(0.3, Math.max(0.09, (f.h || 0.8) * 0.2));
  const r = Math.min(w, d) / 2;

  parts.push(cyl('pot', [r * 0.95, r * 0.72, potH, 18], [0, potH / 2, 0], pot));
  parts.push(cyl('rim', [r, r * 0.97, potH * 0.18, 18], [0, potH * 0.9, 0], pot));
  parts.push(cyl('soil', [r * 0.85, r * 0.85, 0.02, 16], [0, potH - 0.005, 0], '#3a2f28'));
  parts.push(...foliageParts(f, potH, f.h || 0.8, false));
  return <group>{parts}</group>;
}

function HangingPlant({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const pot = f.accent;
  const drop = f.h || 0.7;
  const parts: React.ReactNode[] = [];
  const r = Math.min(w, d) / 2;
  const potH = r * 1.1;

  // chain up to the ceiling
  parts.push(cyl('chain', [0.006, 0.006, Math.max(0.05, drop - potH), 6], [0, potH / 2 + Math.max(0.05, drop - potH) / 2, 0], '#3d405b'));
  for (const s of [-1, 1]) {
    parts.push(
      <mesh key={`str${s}`} position={[s * r * 0.6, potH * 0.85, 0]} rotation={[0, 0, s * 0.55]}>
        <boxGeometry args={[0.006, potH * 0.9, 0.006]} />
        <Mat color="#3d405b" />
      </mesh>,
    );
  }
  parts.push(cyl('pot', [r * 0.9, r * 0.7, potH, 16], [0, potH / 2, 0], pot));
  parts.push(cyl('soil', [r * 0.8, r * 0.8, 0.02, 14], [0, potH - 0.01, 0], '#3a2f28'));
  // foliage trails downward from the pot (y1 below pot bottom)
  parts.push(...foliageParts({ ...f, spec: { ...f.spec, foliage: f.spec.foliage ?? 'trailing' } }, potH * 0.4, -drop * 0.4, true));
  return <group>{parts}</group>;
}

// ------------------------------------------------------------------ textiles
function Curtain({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const L = sp.length ?? 2.2;
  const c = f.color;
  const a = f.accent;
  const parts: React.ReactNode[] = [];
  const back = d / 2;

  // rod across the top
  parts.push(cyl('rod', [0.015, 0.015, w + 0.12, 10], [0, L / 2, back - 0.02], a, [0, 0, Math.PI / 2]));
  for (const s of [-1, 1]) {
    parts.push(sph(`fin${s}`, 0.03, [(s * (w + 0.12)) / 2, L / 2, back - 0.02], a));
  }

  if (f.kind === 'blind' || f.kind === 'shade') {
    // headbox + slats (blind) or flat panel (shade)
    parts.push(box('head', [w, 0.07, d], [0, L / 2 - 0.045, back - d / 2], c));
    if (f.kind === 'blind') {
      const slats = Math.max(6, Math.round(L / 0.09));
      for (let i = 0; i < slats; i++) {
        const y = L / 2 - 0.1 - i * ((L - 0.2) / slats);
        if (y < -L / 2 + 0.05) break;
        parts.push(box(`sl${i}`, [w - 0.03, 0.035, d * 0.55], [0, y, back - d / 2], c, [0.5, 0, 0]));
      }
      parts.push(box('rail', [w - 0.03, 0.04, d * 0.7], [0, -L / 2 + 0.06, back - d / 2], a));
      parts.push(cyl('cord', [0.004, 0.004, L * 0.8, 6], [w / 2 - 0.06, 0, back - d - 0.02], a));
    } else {
      parts.push(box('panel', [w - 0.02, L - 0.1, Math.min(0.03, d)], [0, -0.05, back - d / 2], c));
      parts.push(box('hem', [w - 0.02, 0.05, Math.min(0.03, d) + 0.01], [0, -L / 2 + 0.08, back - d / 2], a));
      if (sp.lined) {
        parts.push(box('fold', [w * 0.3, L - 0.2, 0.015], [-w * 0.2, -0.05, back - d - 0.01], a));
      }
    }
    return <group>{parts}</group>;
  }

  // curtain pair: two wavy panels
  const panels = 2;
  const per = w / panels;
  for (let p = 0; p < panels; p++) {
    const cx = -w / 2 + per * (p + 0.5);
    const folds = 5;
    for (let i = 0; i < folds; i++) {
      const fx = cx - per / 2 + (per / folds) * (i + 0.5);
      const wob = Math.sin(i * 1.7 + p) * 0.03;
      parts.push(
        <mesh key={`f${p}${i}`} position={[fx, -0.06, back - d / 2 + wob]} castShadow receiveShadow>
          <boxGeometry args={[per / folds + 0.02, L - 0.14, 0.045]} />
          <Mat color={c} rough={0.9} />
        </mesh>,
      );
    }
    // gathered top
    parts.push(box(`top${p}`, [per, 0.07, 0.06], [cx, L / 2 - 0.09, back - d / 2], a));
    if (sp.lined) parts.push(box(`lin${p}`, [per * 0.9, L - 0.3, 0.01], [cx, -0.1, back - 0.01], a));
  }
  return <group>{parts}</group>;
}

function SoftGoods({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const c = f.color;
  const a = f.accent;
  const h = f.h || 0.2;
  const parts: React.ReactNode[] = [];

  if (sp.pillow) {
    parts.push(box('body', [w, h, d], [0, h / 2, 0], c, undefined, 0.95));
    parts.push(box('band', [w * 0.98, h * 0.3, d + 0.01], [0, h / 2, 0], a, undefined, 0.95));
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      parts.push(sph(`t${sx}${sz}`, 0.03, [(sx * w) / 2, h * 0.15, (sz * d) / 2], a));
    }
  } else if (sp.folded) {
    // folded throw
    parts.push(box('b1', [w, h * 0.5, d], [0, h * 0.25, 0], c, undefined, 0.95));
    parts.push(box('b2', [w * 0.94, h * 0.35, d * 0.95], [0.01, h * 0.68, 0], a, undefined, 0.95));
    parts.push(box('b3', [w * 0.88, h * 0.2, d * 0.9], [-0.01, h * 0.92, 0.01], c, undefined, 0.95));
  } else if (sp.cushion) {
    parts.push(box('body', [w, h, d], [0, h / 2, 0], c, undefined, 0.95));
    parts.push(box('pip', [w + 0.015, h * 0.5, d + 0.015], [0, h / 2, 0], a, undefined, 0.95));
    parts.push(sph('btn', 0.03, [0, h, 0], a));
  } else if (sp.runner) {
    parts.push(box('run', [w, 0.012, d], [0, 0.006, 0], c, undefined, 0.95));
    parts.push(box('st', [w * 0.9, 0.004, d * 0.4], [0, 0.014, 0], a));
  } else {
    parts.push(box('body', [w, h, d], [0, h / 2, 0], c, undefined, 0.95));
  }
  return <group>{parts}</group>;
}

// ---------------------------------------------------------------- wall decor
/** Visual height of a wall-mounted piece (for hitbox + selection). */
export function wallHeight(f: FurnItem): number {
  const sp = f.spec;
  if (sp.length) return sp.length;
  if (f.type === 'walldecor') {
    switch (sp.style) {
      case 'mirror':
        return sp.round ? f.w : f.w * 1.3;
      case 'clock':
        return f.w * 0.95;
      case 'shelf':
        return 0.3;
      case 'sculpt':
        return f.w * 0.85;
      case 'tapestry':
        return f.w * 1.15;
      case 'mural':
        return f.w * 0.9;
      default:
        return f.w * 0.72;
    }
  }
  if (f.type === 'walllight') return f.kind === 'swing' ? 0.5 : 0.35;
  if (f.type === 'archlight') return f.kind === 'step' ? 0.35 : 0.18;
  if (f.type === 'vamirror') return vamirrorH(f);
  if (f.type === 'towelrack') {
    switch (f.spec.style) {
      case 'ladder':
        return 0.85;
      case 'ring':
        return 0.55;
      case 'shelf':
        return 0.5;
      case 'hooks':
        return 0.6;
      default:
        return 0.62;
    }
  }
  return Math.max(0.4, Math.min(1.4, f.h));
}

function WallDecor({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const c = f.color;
  const a = f.accent;
  const back = d / 2;
  const H = wallHeight(f);
  const parts: React.ReactNode[] = [];

  switch (sp.style) {
    case 'mirror': {
      const R = w / 2;
      parts.push(
        <mesh key="glass" position={[0, 0, back - 0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[R, R, 0.02, sp.round ? 32 : 24]} />
          <meshStandardMaterial color="#cfe0ea" roughness={0.08} metalness={0.85} />
        </mesh>,
      );
      // frame ring (or side frame for ovals)
      if (sp.round) {
        parts.push(
          <mesh key="ring" position={[0, 0, back - 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[R, 0.018, 10, 40]} />
            <Mat color={a} metal={0.7} rough={0.3} />
          </mesh>,
        );
      } else {
        parts.push(box('frm', [w + 0.03, H + 0.03, 0.025], [0, 0, back - 0.025], a));
        parts.push(box('face', [w - 0.01, H - 0.01, 0.02], [0, 0, back - 0.035], '#cfe0ea'));
      }
      break;
    }
    case 'clock': {
      const R = w / 2;
      parts.push(cyl('dial', [R, R, 0.03, sp.round ? 32 : 4], [0, 0, back - 0.02], c, [Math.PI / 2, 0, sp.round ? 0 : Math.PI / 4]));
      parts.push(box('face', [R * 1.5, R * 1.5, 0.012], [0, 0, back - 0.035], '#f6f3ec'));
      parts.push(box('hh', [0.03, R * 0.5, 0.01], [0, R * 0.22, back - 0.045], '#2c3242'));
      parts.push(box('mh', [0.02, R * 0.75, 0.01], [R * 0.2, R * 0.25, back - 0.045], '#2c3242', [0, 0, -0.8]));
      parts.push(sph('pin', 0.02, [0, 0, back - 0.05], a));
      if (!sp.round) {
        // sunburst spikes
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          parts.push(
            <mesh key={`sp${i}`} position={[Math.cos(ang) * R * 1.15, Math.sin(ang) * R * 1.15, back - 0.02]} rotation={[0, 0, ang]}>
              <boxGeometry args={[R * 0.5, 0.02, 0.01]} />
              <Mat color={a} metal={0.7} rough={0.3} />
            </mesh>,
          );
        }
      }
      break;
    }
    case 'shelf': {
      parts.push(box('board', [w, 0.035, d], [0, 0, back - d / 2], c));
      for (const s of [-1, 1]) {
        parts.push(box(`br${s}`, [0.03, 0.14, d * 0.7], [s * (w / 2 - 0.1), -0.08, back - d * 0.6], a));
      }
      // a couple of props on the ledge
      parts.push(box('bk', [0.12, 0.16, 0.1], [-w * 0.2, 0.1, back - d / 2], '#a26769'));
      parts.push(sph('vase', 0.05, [w * 0.22, 0.07, back - d / 2], a, [1, 1.3, 1]));
      break;
    }
    case 'sculpt': {
      const R = w * 0.3;
      parts.push(
        <mesh key="o1" position={[-R * 0.5, R * 0.4, back - 0.04]} rotation={[0.3, 0.4, 0.5]} castShadow>
          <torusGeometry args={[R * 0.7, R * 0.18, 10, 24]} />
          <Mat color={a} metal={0.65} rough={0.3} />
        </mesh>,
      );
      parts.push(
        <mesh key="o2" position={[R * 0.55, -R * 0.3, back - 0.05]} rotation={[0.2, 0, -0.4]} castShadow>
          <icosahedronGeometry args={[R * 0.55, 0]} />
          <Mat color={c} metal={0.5} rough={0.35} />
        </mesh>,
      );
      parts.push(box('bar', [w * 0.8, 0.02, 0.02], [0, -R, back - 0.03], a));
      break;
    }
    case 'tapestry': {
      parts.push(box('cloth', [w, H, 0.02], [0, 0, back - 0.015], c, undefined, 0.95));
      parts.push(box('stripe', [w * 0.9, H * 0.25, 0.008], [0, H * 0.15, back - 0.03], a, undefined, 0.95));
      parts.push(box('stripe2', [w * 0.7, H * 0.12, 0.008], [0, -H * 0.2, back - 0.03], a, undefined, 0.95));
      for (let i = 0; i < 8; i++) {
        parts.push(cyl(`fr${i}`, [0.006, 0.004, 0.08, 6], [-w / 2 + (w / 7) * i, -H / 2 - 0.04, back - 0.02], a));
      }
      parts.push(cyl('rod', [0.012, 0.012, w, 10], [0, H / 2 + 0.02, back - 0.02], a, [0, 0, Math.PI / 2]));
      break;
    }
    case 'mural': {
      parts.push(box('panel', [w, H, 0.02], [0, 0, back - 0.012], c, undefined, 0.95));
      parts.push(box('arch', [w * 0.5, H * 0.7, 0.008], [0, -H * 0.1, back - 0.025], a, undefined, 0.95));
      parts.push(sph('sun', w * 0.1, [w * 0.25, H * 0.25, back - 0.03], a));
      break;
    }
    default: {
      // framed artwork / canvas
      const frameD = Math.min(0.05, d);
      parts.push(box('frame', [w, H, frameD], [0, 0, back - frameD / 2], a));
      parts.push(box('canvas', [w - 0.07, H - 0.07, 0.015], [0, 0, back - frameD - 0.005], c));
      // abstract composition
      parts.push(box('band', [w * 0.7, H * 0.18, 0.006], [-w * 0.05, -H * 0.15, back - frameD - 0.016], a));
      parts.push(sph('dot', Math.min(w, H) * 0.14, [w * 0.18, H * 0.18, back - frameD - 0.02], a));
      break;
    }
  }
  return <group>{parts}</group>;
}

// ------------------------------------------------------------ tabletop accents
function Tabletop({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const c = f.color;
  const a = f.accent;
  const h = f.h || 0.2;
  const parts: React.ReactNode[] = [];
  const r = Math.min(w, d) / 2;

  switch (f.kind) {
    case 'bowl': {
      parts.push(
        <mesh key="bowl" position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r * 0.55, h, 24, 1, true]} />
          <meshStandardMaterial color={c} side={2} roughness={0.55} />
        </mesh>,
      );
      parts.push(cyl('bot', [r * 0.55, r * 0.5, 0.02, 20], [0, 0.01, 0], c));
      break;
    }
    case 'vase': {
      parts.push(cyl('body', [r, r * 0.6, h * 0.65, 18], [0, h * 0.33, 0], c));
      parts.push(cyl('neck', [r * 0.35, r * 0.5, h * 0.35, 14], [0, h * 0.82, 0], c));
      // a few stems
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        parts.push(
          <mesh key={`st${i}`} position={[Math.cos(ang) * 0.03, h + 0.09, Math.sin(ang) * 0.03]} rotation={[Math.sin(ang) * 0.3, 0, -Math.cos(ang) * 0.3]}>
            <cylinderGeometry args={[0.004, 0.004, 0.2, 5]} />
            <Mat color="#5f8f5a" rough={0.9} />
          </mesh>,
        );
        parts.push(sph(`lf${i}`, 0.035, [Math.cos(ang) * 0.07, h + 0.18, Math.sin(ang) * 0.07], '#6b8f4e', [1, 0.5, 1]));
      }
      break;
    }
    case 'candle': {
      const n = f.name.includes('Trio') ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : (i - 1) * r * 0.75;
        const ch = h * (n === 1 ? 1 : i === 1 ? 1 : 0.75);
        parts.push(cyl(`c${i}`, [r * (n === 1 ? 0.8 : 0.4), r * (n === 1 ? 0.85 : 0.45), ch, 16], [x, ch / 2, 0], n === 1 ? a : c));
        parts.push(glowSphere(`fl${i}`, 0.018, [x, ch + 0.03, 0], '#ffcf7a', [1, 1.8, 1]));
      }
      parts.push(cyl('base', [r * 1.05, r * 1.1, 0.02, 20], [0, 0.01, 0], a));
      break;
    }
    case 'tray': {
      parts.push(box('floor', [w, 0.02, d], [0, 0.01, 0], c));
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        parts.push(box(`rim${sx}${sz}`, [sx === -1 ? 0.02 : 0.02, 0.035, d], [(sx * (w - 0.02)) / 2, 0.035, 0], a));
        break;
      }
      parts.push(box('rimX1', [w, 0.035, 0.02], [0, 0.035, (d - 0.02) / 2], a));
      parts.push(box('rimX2', [w, 0.035, 0.02], [0, 0.035, -(d - 0.02) / 2], a));
      parts.push(box('rimZ1', [0.02, 0.035, d], [(w - 0.02) / 2, 0.035, 0], a));
      parts.push(box('rimZ2', [0.02, 0.035, d], [-(w - 0.02) / 2, 0.035, 0], a));
      break;
    }
    case 'sculpture': {
      if (f.name.includes('Orb') || f.name.includes('Knot')) {
        parts.push(sph('orb', r, [0, r, 0], c));
        parts.push(sph('orb2', r * 0.6, [r * 0.5, r * 1.6, 0], a));
      } else {
        parts.push(box('plinth', [w * 0.8, 0.03, d * 0.8], [0, 0.015, 0], a));
        parts.push(
          <mesh key="fig" position={[0, h * 0.55, 0]} rotation={[0.2, 0.5, 0.3]} castShadow>
            <torusKnotGeometry args={[r * 0.5, r * 0.18, 48, 8]} />
            <Mat color={c} metal={0.4} rough={0.35} />
          </mesh>,
        );
      }
      break;
    }
    case 'bookends': {
      for (const s of [-1, 1]) {
        parts.push(box(`be${s}`, [0.03, h, d], [s * (w / 2 - 0.015), h / 2, 0], a));
        parts.push(box(`bf${s}`, [0.1, 0.02, d], [s * (w / 2 - 0.06), 0.01, 0], a));
      }
      const bc = ['#a26769', '#45608a', '#a3b18a'];
      for (let i = 0; i < 3; i++) {
        parts.push(box(`bk${i}`, [0.03, h * 0.8, d * 0.85], [-0.05 + i * 0.035, h * 0.42, 0], bc[i]));
      }
      break;
    }
    case 'diffuser': {
      parts.push(cyl('bot', [r, r, h * 0.55, 16], [0, h * 0.28, 0], c));
      parts.push(cyl('col', [r * 0.4, r * 0.5, 0.04, 12], [0, h * 0.58, 0], a));
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        parts.push(
          <mesh key={`rd${i}`} position={[Math.cos(ang) * 0.02, h * 0.6 + 0.08, Math.sin(ang) * 0.02]} rotation={[Math.sin(ang) * 0.35, 0, -Math.cos(ang) * 0.35]}>
            <cylinderGeometry args={[0.003, 0.004, h * 0.7, 4]} />
            <Mat color="#d9c2a0" rough={0.9} />
          </mesh>,
        );
      }
      break;
    }
    case 'box': {
      parts.push(box('base', [w, h * 0.7, d], [0, h * 0.35, 0], c));
      parts.push(box('lid', [w + 0.02, h * 0.3, d + 0.02], [0, h * 0.85, 0], a));
      parts.push(sph('knob', 0.02, [0, h * 1.02, 0], a));
      break;
    }
    case 'books': {
      const bc = ['#45608a', '#a26769', '#a3b18a'];
      for (let i = 0; i < 3; i++) {
        parts.push(
          box(`b${i}`, [w - i * 0.03, 0.055, d - i * 0.02], [i * 0.012, 0.03 + i * 0.055, 0], bc[i], [0, i * 0.12 - 0.1, 0]),
        );
      }
      parts.push(box('band', [w * 0.9, 0.01, d * 0.9], [0.02, h * 0.5, 0], a, [0, 0.05, 0]));
      break;
    }
    default: {
      parts.push(box('body', [w, h, d], [0, h / 2, 0], c));
      break;
    }
  }
  return <group>{parts}</group>;
}

// ------------------------------------------------------- functional accents
function Functional({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const c = f.color;
  const a = f.accent;
  const h = f.h || 1;
  const parts: React.ReactNode[] = [];

  switch (sp.style) {
    case 'fire': {
      parts.push(box('body', [w, h, d], [0, h / 2, 0], c));
      parts.push(box('mantel', [w + 0.08, 0.06, d + 0.06], [0, h - 0.03, 0], a));
      parts.push(box('plinth', [w + 0.04, 0.08, d + 0.04], [0, 0.04, 0], a));
      // firebox (front = +z)
      const fw = w * 0.55;
      const fh = h * 0.4;
      parts.push(box('box', [fw, fh, 0.06], [0, h * 0.38, d / 2 + 0.01], '#1c1410'));
      parts.push(glowBox('fire', [fw * 0.8, fh * 0.5, 0.02], [0, h * 0.33, d / 2 + 0.045], '#ff8c42', 1.6));
      for (let i = 0; i < 3; i++) {
        parts.push(glowSphere(`fl${i}`, 0.05 + rnd(i) * 0.04, [(i - 1) * fw * 0.22, h * 0.3 + rnd(i + 2) * 0.08, d / 2 + 0.05], '#ffb347', [1, 1.6, 0.6]));
      }
      parts.push(<pointLight key="pl" position={[0, h * 0.4, d / 2 + 0.4]} intensity={0.6} distance={3.5} color="#ff9d4d" castShadow={false} />);
      break;
    }
    case 'panels': {
      const n = sp.panels ?? 3;
      const pw = w / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + pw * (i + 0.5);
        const ang = i % 2 === 0 ? 0.35 : -0.35;
        parts.push(
          <mesh key={`p${i}`} position={[x, h / 2, Math.sin(ang) * 0.14]} rotation={[0, ang, 0]} castShadow receiveShadow>
            <boxGeometry args={[pw * 0.98, h, 0.025]} />
            <Mat color={i % 2 ? a : c} rough={0.85} />
          </mesh>,
        );
        // slat detail
        for (let k = 1; k < 5; k++) {
          parts.push(
            <mesh key={`s${i}${k}`} position={[x, (h / 5) * k, Math.sin(ang) * 0.14 + 0.016]} rotation={[0, ang, 0]}>
              <boxGeometry args={[pw * 0.9, 0.015, 0.008]} />
              <Mat color="#3d405b" />
            </mesh>,
          );
        }
      }
      break;
    }
    case 'basket': {
      parts.push(
        <mesh key="body" position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[w / 2, w / 2 * 0.78, h, 20, 1, true]} />
          <meshStandardMaterial color={c} side={2} roughness={0.9} />
        </mesh>,
      );
      for (let i = 0; i < 4; i++) {
        parts.push(
          <mesh key={`rr${i}`} position={[0, h * (0.2 + i * 0.2), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[w / 2 * (0.82 + i * 0.045), 0.008, 6, 24]} />
            <Mat color={a} rough={0.9} />
          </mesh>,
        );
      }
      parts.push(cyl('base', [w / 2 * 0.78, w / 2 * 0.78, 0.02, 20], [0, 0.01, 0], a));
      // blanket poking out
      parts.push(sph('blanket', w * 0.3, [0.03, h - 0.02, 0], '#e0dcd5', [1, 0.5, 1]));
      break;
    }
    case 'rack': {
      if (sp.style === 'rack' && w > 0.6) {
        // hall tree: frame + bar + hooks
        parts.push(box('rail', [w, 0.06, 0.05], [0, h - 0.1, 0], c));
        parts.push(box('bench', [w, 0.06, d * 0.8], [0, 0.45, 0], a));
        for (const s of [-1, 1]) {
          parts.push(box(`post${s}`, [0.06, h, 0.05], [s * (w / 2 - 0.03), h / 2, -d / 2 + 0.03], c));
          parts.push(box(`hook${s}`, [0.1, 0.03, 0.08], [s * (w / 2 - 0.12), h - 0.22, 0.02], a));
          parts.push(box(`leg${s}`, [0.05, 0.45, 0.05], [s * (w / 2 - 0.1), 0.22, 0], a));
        }
        parts.push(box('shelf', [w * 0.8, 0.03, 0.14], [0, h * 0.7, 0], a));
      } else {
        // standing coat rack: pole + feet + hooks
        parts.push(cyl('pole', [0.03, 0.04, h, 12], [0, h / 2, 0], c));
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + 0.4;
          parts.push(
            <mesh key={`hk${i}`} position={[Math.cos(ang) * 0.1, h - 0.12, Math.sin(ang) * 0.1]} rotation={[0, -ang, 0.5]}>
              <boxGeometry args={[0.14, 0.02, 0.02]} />
              <Mat color={a} />
            </mesh>,
          );
          parts.push(
            <mesh key={`ft${i}`} position={[Math.cos(ang) * 0.14, 0.03, Math.sin(ang) * 0.14]} rotation={[0, -ang, 0]}>
              <boxGeometry args={[0.24, 0.04, 0.04]} />
              <Mat color={a} />
            </mesh>,
          );
        }
        parts.push(sph('top', 0.05, [0, h, 0], a));
      }
      break;
    }
    case 'stand': {
      parts.push(
        <mesh key="body" position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[w / 2, w / 2 * 0.8, h, 16, 1, true]} />
          <meshStandardMaterial color={c} side={2} roughness={0.6} />
        </mesh>,
      );
      parts.push(cyl('base', [w / 2 * 0.8, w / 2 * 0.8, 0.02, 16], [0, 0.01, 0], a));
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        parts.push(
          <mesh key={`um${i}`} position={[Math.cos(ang) * 0.02, h * 0.75, Math.sin(ang) * 0.02]} rotation={[Math.sin(ang) * 0.18, 0, -Math.cos(ang) * 0.18]}>
            <cylinderGeometry args={[0.012, 0.012, h * 1.1, 6]} />
            <Mat color={i === 1 ? '#45608a' : '#3d405b'} rough={0.5} />
          </mesh>,
        );
      }
      break;
    }
    default: {
      // hamper / laundry
      parts.push(
        <mesh key="body" position={[0, h * 0.47, 0]} scale={[1, 1, d / w]} castShadow receiveShadow>
          <cylinderGeometry args={[w / 2, w / 2 * 0.9, h * 0.9, 20, 1, false]} />
          <Mat color={c} rough={0.9} />
        </mesh>,
      );
      if (sp.style === 'hamper') {
        parts.push(cyl('lid', [w / 2 + 0.015, w / 2 * 0.98, 0.05, 20], [0, h * 0.95, 0], a));
        parts.push(sph('knob', 0.03, [0, h * 0.99, 0], a));
      } else {
        // sorter: fabric bags
        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI * 2;
          parts.push(box(`bg${i}`, [0.16, h * 0.5, 0.14], [Math.cos(ang) * w * 0.24, h * 0.5, Math.sin(ang) * w * 0.24], ['#e0dcd5', '#c9d2d9', '#d9c2a0'][i]));
        }
        parts.push(box('frame', [w, 0.04, d], [0, h * 0.78, 0], a));
      }
      break;
    }
  }
  return <group>{parts}</group>;
}

// ----------------------------------------------------------------- bathroom
/** One shared reflective canvas texture for every mirror face. */
let mirrorTex: CanvasTexture | null = null;
function mirrorTexture(): CanvasTexture {
  if (mirrorTex) return mirrorTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#f7fbfd');
  grad.addColorStop(0.42, '#dfeaf1');
  grad.addColorStop(0.58, '#b9cdd9');
  grad.addColorStop(1, '#eef4f8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.5;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(12, 0);
  g.lineTo(42, 0);
  g.lineTo(0, 42);
  g.lineTo(0, 12);
  g.closePath();
  g.fill();
  g.globalAlpha = 0.26;
  g.beginPath();
  g.moveTo(64, 128);
  g.lineTo(86, 128);
  g.lineTo(128, 86);
  g.lineTo(128, 64);
  g.closePath();
  g.fill();
  mirrorTex = new CanvasTexture(cv);
  return mirrorTex;
}

/** Full visual height of a vanity mirror — geometry and hitbox agree on it. */
function vamirrorH(f: FurnItem): number {
  if (f.spec.style === 'round') return f.w + 0.04;
  return Math.min(f.w * 1.25 + 0.04, 0.95);
}

const CHROME = '#d3d9df';
const PORCELAIN = '#f2efe9';

/** Translucent glass — the shower enclosure material (frosted variant too). */
function showerGlass(frost?: boolean) {
  return (
    <meshPhysicalMaterial
      color={frost ? '#dfeef2' : '#e9f4f8'}
      transmission={frost ? 0.85 : 0.94}
      thickness={0.05}
      roughness={frost ? 0.5 : 0.05}
      ior={1.45}
    />
  );
}

/** Cabinet + countertop + porcelain basin + chrome faucet. Back (−z) to wall. */
function Vanity({ f }: { f: FurnItem }) {
  const { w, d, h } = f;
  const sp = f.spec;
  const c = f.color;
  const top = f.accent;
  const parts: React.ReactNode[] = [];
  const style = sp.style ?? 'single';
  const bodyTop = h - 0.07;
  const bodyBot = style === 'floating' ? 0.24 : style === 'pedestal' ? 0 : style === 'console' ? 0.3 : 0.1;

  if (style === 'pedestal') {
    parts.push(
      <mesh key="ped" position={[0, (h - 0.13) / 2, 0.02]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.16, h - 0.13, 18]} />
        <Mat color={PORCELAIN} rough={0.14} />
      </mesh>,
    );
    parts.push(metalBox('apron', [w - 0.1, 0.14, d - 0.08], [0, bodyTop - 0.07, 0], PORCELAIN, 0.02, 0.2));
  } else {
    if (bodyBot > 0 && style !== 'floating') {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          parts.push(
            metalCyl(`lg${sx}${sz}`, [0.018, 0.018, bodyBot, 8], [sx * (w / 2 - 0.06), bodyBot / 2, sz * (d / 2 - 0.06)], CHROME),
          );
    }
    const bodyH = bodyTop - bodyBot;
    parts.push(box('body', [w - 0.03, bodyH, d - 0.04], [0, bodyBot + bodyH / 2, 0.01], c, undefined, 0.5));
    // door seams + handles on the room side
    const zf = (d - 0.04) / 2 + 0.017;
    const doors = style === 'double' ? 2 : 1;
    const pw = (w - 0.03) / doors;
    for (let i = 0; i < doors; i++) {
      const cx = -(w - 0.03) / 2 + pw * (i + 0.5);
      if (i > 0) parts.push(box(`sm${i}`, [0.012, bodyH - 0.06, 0.012], [cx - pw / 2, bodyBot + bodyH / 2, zf], '#3d405b'));
      parts.push(metalBox(`hd${i}`, [0.02, bodyH * 0.3, 0.02], [cx + pw * 0.3, bodyBot + bodyH * 0.55, zf + 0.008], CHROME));
    }
  }
  // countertop (slight overhang) + basins
  parts.push(box('top', [w, 0.06, d], [0, h - 0.03, 0], top, undefined, 0.25));
  const basins = style === 'double' ? [-w * 0.24, w * 0.24] : [0];
  const bw = Math.min(w * 0.16, d * 0.28);
  const fz = -(d / 2 - 0.07);
  for (const bx of basins) {
    parts.push(
      <mesh key={`bs${bx}`} position={[bx, h + 0.035, 0.01]} scale={[bw, 0.07, bw]} castShadow>
        <cylinderGeometry args={[1, 0.94, 1, 20]} />
        <Mat color={PORCELAIN} rough={0.12} />
      </mesh>,
    );
    parts.push(
      <mesh key={`bh${bx}`} position={[bx, h + 0.03, 0.01]} scale={[bw * 0.74, 0.06, bw * 0.74]}>
        <cylinderGeometry args={[1, 0.9, 1, 20]} />
        <Mat color="#cfdbe2" rough={0.15} />
      </mesh>,
    );
    parts.push(metalCyl(`dr${bx}`, [0.016, 0.016, 0.008, 10], [bx, h + 0.061, 0.01], CHROME, 0.6, 0.35));
    parts.push(metalCyl(`fc${bx}`, [0.016, 0.02, 0.13, 10], [bx, h + 0.065, fz], CHROME));
    parts.push(metalBox(`fs${bx}`, [0.016, 0.016, 0.09], [bx, h + 0.13, fz + 0.045], CHROME, 0.65, 0.25, [-0.2, 0, 0]));
    parts.push(metalBox(`fl${bx}`, [0.01, 0.03, 0.014], [bx, h + 0.145, fz - 0.012], CHROME));
  }
  return <group>{parts}</group>;
}

/** Freestanding / alcove tub: glossy shell, water fill, chrome hardware. */
function Bathtub({ f }: { f: FurnItem }) {
  const { w, d, h } = f;
  const sp = f.spec;
  const c = sp.copper ? '#b87333' : f.color;
  const rough = sp.copper ? 0.35 : 0.14;
  const metal = sp.copper ? 0.65 : 0.02;
  const chrome = f.accent;
  const water = '#8ec5d6';
  const parts: React.ReactNode[] = [];

  if (sp.style === 'alcove') {
    parts.push(box('body', [w, h - 0.16, d], [0, (h - 0.16) / 2, 0], c, undefined, rough));
    parts.push(box('water', [w - 0.14, 0.1, d - 0.14], [0, h - 0.11, 0], water, undefined, 0.08));
    parts.push(box('rf', [w, 0.16, 0.07], [0, h - 0.08, d / 2 - 0.035], c, undefined, rough));
    parts.push(box('rb', [w, 0.16, 0.07], [0, h - 0.08, -(d / 2 - 0.035)], c, undefined, rough));
    parts.push(box('rl', [0.07, 0.16, d - 0.14], [-(w / 2 - 0.035), h - 0.08, 0], c, undefined, rough));
    parts.push(box('rr', [0.07, 0.16, d - 0.14], [w / 2 - 0.035, h - 0.08, 0], c, undefined, rough));
    // deck faucet on the wall side (back = −z)
    parts.push(metalBox('spout', [0.016, 0.016, 0.1], [0, h + 0.04, -(d / 2 - 0.12)], chrome));
    parts.push(metalCyl('kn1', [0.025, 0.025, 0.03, 10], [-0.12, h + 0.02, -(d / 2 - 0.09)], chrome));
    parts.push(metalCyl('kn2', [0.025, 0.025, 0.03, 10], [0.12, h + 0.02, -(d / 2 - 0.09)], chrome));
    if (sp.screen) {
      parts.push(
        <mesh key="scr" position={[w / 2 - 0.3, h + 0.42, 0]}>
          <boxGeometry args={[0.015, 0.85, d - 0.12]} />
          {showerGlass()}
        </mesh>,
      );
    }
    if (sp.door) {
      parts.push(
        <mesh key="hatch" position={[w * 0.18, h * 0.5, d / 2 + 0.004]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.02, 24]} />
          <Mat color="#f4f1ea" rough={0.18} />
        </mesh>,
      );
      parts.push(
        <mesh key="hring" position={[w * 0.18, h * 0.5, d / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.012, 8, 28]} />
          <Mat color={chrome} rough={0.28} metal={0.6} />
        </mesh>,
      );
    }
  } else {
    const rx = w / 2;
    const rz = d / 2;
    parts.push(
      <mesh key="shell" position={[0, h / 2, 0]} scale={[rx, h, rz]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 1, 28, 1, true]} />
        <meshStandardMaterial color={c} roughness={rough} metalness={metal} side={2} />
      </mesh>,
    );
    parts.push(
      <mesh key="base" position={[0, 0.02, 0]} scale={[rx * 0.97, 1, rz * 0.97]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.04, 28]} />
        <Mat color={c} rough={rough} />
      </mesh>,
    );
    parts.push(
      <mesh key="water" position={[0, h * 0.5, 0]} scale={[rx * 0.93, 1, rz * 0.93]}>
        <cylinderGeometry args={[1, 1, 0.02, 28]} />
        <Mat color={water} rough={0.08} />
      </mesh>,
    );
    parts.push(
      <mesh key="rim" position={[0, h - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[rx, rz, 1]} castShadow>
        <torusGeometry args={[1, 0.045, 10, 36]} />
        <Mat color={c} rough={rough} />
      </mesh>,
    );
    if (sp.style === 'slipper') {
      parts.push(
        <mesh key="slip" position={[-(rx * 0.84), h - 0.04, 0]} scale={[rx * 0.17, h * 0.34, rz * 0.9]} castShadow>
          <sphereGeometry args={[1, 16, 12]} />
          <Mat color={c} rough={rough} />
        </mesh>,
      );
    }
    // floor-standing filler at one end
    const fx = -(rx + 0.07);
    parts.push(metalCyl('post', [0.018, 0.022, h + 0.14, 10], [fx, (h + 0.14) / 2, 0], chrome));
    parts.push(metalBox('arm', [0.1, 0.015, 0.015], [fx + 0.05, h + 0.13, 0], chrome));
    parts.push(metalBox('lever', [0.015, 0.05, 0.015], [fx, h + 0.17, -0.03], chrome));
    if (sp.feet) {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          parts.push(sph(`ft${sx}${sz}`, 0.05, [sx * (rx - 0.04), 0.04, sz * (rz - 0.03)], chrome));
    }
  }
  return <group>{parts}</group>;
}

/** Glass enclosure: tray + translucent panels + chrome frame and column. */
function Shower({ f }: { f: FurnItem }) {
  const { w, d, h } = f;
  const sp = f.spec;
  const c = f.color;
  const frameC = sp.black ? '#262a33' : sp.brass ? '#c9a227' : CHROME;
  const frameMetal = sp.black ? 0.4 : sp.brass ? 0.7 : 0.65;
  const parts: React.ReactNode[] = [];
  const trayH = 0.08;
  const panelH = h - trayH;
  const panelY = trayH + panelH / 2;
  const tiled = !!sp.tile;

  parts.push(box('tray', [w, trayH, d], [0, trayH / 2, 0], c, undefined, 0.15));
  parts.push(box('floor', [w - 0.1, 0.012, d - 0.1], [0, trayH + 0.006, 0], '#d5dde2', undefined, 0.4));
  parts.push(metalCyl('drain', [0.04, 0.04, 0.014, 12], [w / 2 - 0.12, trayH + 0.014, d / 2 - 0.12], '#aab3bd', 0.6, 0.35));

  const panel = (key: string, args: [number, number, number], pos: [number, number, number]) =>
    tiled ? (
      box(key, args, pos, '#e8e3d9', undefined, 0.18)
    ) : (
      <mesh key={key} position={pos}>
        <boxGeometry args={args} />
        {showerGlass(sp.frost)}
      </mesh>
    );

  parts.push(panel('bk', [w, panelH, 0.016], [0, panelY, -(d / 2 - 0.008)]));
  parts.push(panel('lf', [0.016, panelH, d - 0.016], [-(w / 2 - 0.008), panelY, 0]));
  parts.push(panel('rt', [0.016, panelH, d - 0.016], [w / 2 - 0.008, panelY, 0]));
  if (sp.style === 'walkin') {
    parts.push(panel('fr', [w / 2 - 0.03, panelH, 0.016], [w / 4, panelY, d / 2 - 0.008]));
  } else if (sp.slide) {
    parts.push(panel('dr1', [w / 2 - 0.02, panelH - 0.06, 0.016], [-w / 4, panelY, d / 2 - 0.02]));
    parts.push(panel('dr2', [w / 2 - 0.02, panelH - 0.06, 0.016], [w / 4 + 0.01, panelY, d / 2 + 0.005]));
  } else {
    parts.push(panel('dr', [w - 0.05, panelH - 0.06, 0.016], [0, panelY, d / 2 - 0.008]));
  }
  if (tiled) {
    for (let i = 1; i < 4; i++)
      parts.push(box(`gr${i}`, [w - 0.02, 0.008, 0.018], [0, trayH + (panelH * i) / 4, -(d / 2 - 0.008)], '#b9c4c9'));
  }

  // chrome posts + top rails
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      parts.push(metalCyl(`p${sx}${sz}`, [0.014, 0.014, panelH, 8], [sx * (w / 2 - 0.014), panelY, sz * (d / 2 - 0.014)], frameC, frameMetal));
  parts.push(metalBox('tr1', [w, 0.026, 0.026], [0, h - 0.013, d / 2 - 0.014], frameC, frameMetal));
  parts.push(metalBox('tr2', [w, 0.026, 0.026], [0, h - 0.013, -(d / 2 - 0.014)], frameC, frameMetal));
  parts.push(metalBox('tr3', [0.026, 0.026, d - 0.03], [-(w / 2 - 0.014), h - 0.013, 0], frameC, frameMetal));
  parts.push(metalBox('tr4', [0.026, 0.026, d - 0.03], [w / 2 - 0.014, h - 0.013, 0], frameC, frameMetal));

  // shower column on the back panel
  const bz = -(d / 2 - 0.05);
  const y0 = 0.5;
  const y1 = h - 0.3;
  parts.push(metalCyl('bar', [0.016, 0.016, y1 - y0, 8], [0, (y0 + y1) / 2, bz], frameC, frameMetal));
  const heads = sp.rain ? [-0.22, 0.22] : [0];
  for (let i = 0; i < heads.length; i++) {
    parts.push(metalBox(`arm${i}`, [0.02, 0.02, 0.18], [heads[i], h - 0.22, bz + 0.09], frameC, frameMetal));
    parts.push(metalCyl(`hd${i}`, [0.1, 0.095, 0.03, 18], [heads[i], h - 0.24, bz + 0.17], frameC, frameMetal));
  }
  parts.push(metalBox('mx', [0.15, 0.17, 0.05], [0, 1.0, bz + 0.02], frameC, frameMetal));
  parts.push(metalCyl('lv', [0.012, 0.012, 0.08, 8], [0.05, 1.08, bz + 0.05], frameC, frameMetal, 0.28, [0, 0, Math.PI / 2]));
  parts.push(metalCyl('hh', [0.028, 0.032, 0.1, 8], [0.16, 1.25, bz + 0.05], frameC, frameMetal, 0.28, [0.4, 0, 0]));

  // door handle (hinged / sliding doors only)
  if (sp.style !== 'walkin') {
    parts.push(metalBox('hnd', [0.022, 0.32, 0.03], [w * 0.3, 1.05, d / 2 + 0.014], frameC, frameMetal));
  }
  return <group>{parts}</group>;
}

/** Ceramic bowl + seat + tank (or wall-hung cistern housing). Back (−z) to wall. */
function Toilet({ f }: { f: FurnItem }) {
  const { w, d, h } = f;
  const sp = f.spec;
  const c = f.color;
  const seatC = sp.black ? '#33373f' : '#f4f2ec';
  const holeC = sp.black ? '#1c1f26' : '#3d405b';
  const parts: React.ReactNode[] = [];
  const wallHung = sp.style === 'wall-hung';
  const bowlLen = wallHung ? d - 0.03 : d * 0.58;
  const bowlZ = wallHung ? 0.01 : d / 2 - bowlLen / 2 - 0.02;
  const bowlTop = wallHung ? 0.44 : 0.42;
  const square = !!sp.square;

  // bowl body
  parts.push(
    <mesh
      key="bowl"
      position={[0, bowlTop - 0.1, bowlZ]}
      scale={square ? [1, 1, 1] : [w / 2, 0.2, bowlLen / 2]}
      castShadow
      receiveShadow
    >
      {square ? <boxGeometry args={[w, 0.2, bowlLen]} /> : <cylinderGeometry args={[1, 1, 1, 20]} />}
      <Mat color={c} rough={0.13} />
    </mesh>,
  );

  if (!wallHung) {
    parts.push(
      <mesh key="ped" position={[0, 0.16, bowlZ - 0.03]} scale={[w * 0.36, 0.32, bowlLen * 0.42]} castShadow>
        <cylinderGeometry args={[1, 0.9, 1, 16]} />
        <Mat color={c} rough={0.14} />
      </mesh>,
    );
    const tankD = Math.min(d * 0.3, 0.22);
    const tankZ = -(d / 2 - tankD / 2) + 0.01;
    // connector between bowl and tank
    const zb = bowlZ - bowlLen / 2;
    const zt = tankZ + tankD / 2;
    if (zt > zb) {
      parts.push(box('conn', [w * 0.6, 0.3, Math.max(0.1, zt - zb + 0.04)], [0, 0.38, (zb + zt) / 2], c, undefined, 0.14));
    }
    // tank + lid + flush button
    parts.push(box('tank', [w * 0.92, h - 0.42, tankD], [0, 0.42 + (h - 0.42) / 2, tankZ], c, undefined, 0.13));
    parts.push(box('tanklid', [w * 0.98, 0.035, tankD + 0.02], [0, h + 0.017, tankZ], '#f1efe9', undefined, 0.15));
    parts.push(metalCyl('btn', [0.03, 0.03, 0.014, 12], [0, h + 0.04, tankZ], CHROME, 0.6, 0.3));
    if (sp.bidet) {
      parts.push(metalCyl('spr', [0.01, 0.01, 0.16, 8], [w / 2 + 0.04, 0.6, tankZ], CHROME, 0.6, 0.3, [0, 0, 0.3]));
    }
  } else {
    // cistern housing flush to the wall + exposed flush plate
    const coverD = 0.07;
    const coverZ = -(d / 2) - 0.02;
    parts.push(box('cover', [w * 0.85, 0.5, coverD], [0, 0.72, coverZ], c, undefined, 0.14));
    parts.push(box('plate', [w * 0.4, 0.13, 0.016], [0, 0.85, coverZ + coverD / 2 + 0.008], seatC, undefined, 0.2));
    for (const s of [-1, 1])
      parts.push(
        <mesh key={`bt${s}`} position={[s * 0.05, 0.85, coverZ + coverD / 2 + 0.018]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.01, 10]} />
          <Mat color={CHROME} rough={0.3} metal={0.6} />
        </mesh>,
      );
  }

  // seat + dark opening + open lid leaning back
  const seatY = bowlTop + 0.02;
  parts.push(
    <mesh key="seat" position={[0, seatY, bowlZ]} scale={square ? [1, 1, 1] : [(w / 2) * 1.04, 0.04, (bowlLen / 2) * 1.04]} castShadow>
      {square ? <boxGeometry args={[w * 1.04, 0.04, bowlLen * 1.04]} /> : <cylinderGeometry args={[1, 1, 1, 20]} />}
      <Mat color={seatC} rough={0.2} />
    </mesh>,
  );
  parts.push(
    <mesh key="hole" position={[0, seatY + 0.021, bowlZ + 0.01]} scale={[(w / 2) * 0.6, 0.004, (bowlLen / 2) * 0.5]}>
      <cylinderGeometry args={[1, 1, 1, 16]} />
      <Mat color={holeC} rough={0.5} />
    </mesh>,
  );
  parts.push(
    <mesh key="lid" position={[0, bowlTop + 0.2, bowlZ - bowlLen / 2 - 0.008]} rotation={[-0.12, 0, 0]} castShadow>
      <boxGeometry args={[w * 0.85, 0.4, 0.024]} />
      <Mat color={seatC} rough={0.25} />
    </mesh>,
  );
  return <group>{parts}</group>;
}

/** Wall frame carrying hung accent towels (bars / ladder / ring / shelf / hooks). */
function TowelRack({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const a = f.accent;
  const towel2 = '#e6e1d8';
  const back = d / 2;
  const frame = sp.black ? '#262a33' : sp.wood ? '#8a6b45' : f.color;
  const metal = sp.wood ? 0.2 : 0.65;
  const barZ = back - 0.055;
  const towelW = Math.min(w * 0.42, 0.3);
  const parts: React.ReactNode[] = [];

  const hangTowel = (key: string, x: number, z: number, col: string, len = 0.42) => [
    <mesh key={`${key}f`} position={[x, 0.005, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.022, 0.022, towelW, 10]} />
      <Mat color={col} rough={0.9} />
    </mesh>,
    box(`${key}b`, [towelW, len, 0.018], [x, -len / 2 - 0.01, z - 0.024], col, undefined, 0.9),
    box(`${key}r`, [towelW, len - 0.06, 0.016], [x, -len / 2 - 0.04, z + 0.024], col, undefined, 0.9),
  ];

  const style = sp.style ?? 'bars';
  if (style === 'bars') {
    const bars = sp.bars ?? 1;
    const zs = bars === 2 ? [barZ - 0.03, barZ + 0.03] : [barZ];
    for (let bi = 0; bi < zs.length; bi++) {
      const z = zs[bi];
      parts.push(
        <mesh key={`bar${bi}`} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, w - 0.05, 8]} />
          <Mat color={frame} rough={0.3} metal={metal} />
        </mesh>,
      );
      for (const s of [-1, 1]) {
        parts.push(box(`arm${bi}${s}`, [0.014, 0.014, back - z + 0.02], [s * (w / 2 - 0.035), 0, (back + z) / 2], frame, undefined, 0.4));
        parts.push(
          <mesh key={`pl${bi}${s}`} position={[s * (w / 2 - 0.035), 0, back - 0.005]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.014, 12]} />
            <Mat color={frame} rough={0.3} metal={metal} />
          </mesh>,
        );
      }
      parts.push(...hangTowel(`tw${bi}`, bi === 0 ? -w * 0.16 : w * 0.16, z, bi === 0 ? a : towel2));
    }
  } else if (style === 'ladder') {
    const H = 0.75;
    for (const s of [-1, 1])
      parts.push(box(`rail${s}`, [0.026, H, 0.026], [s * (w / 2 - 0.02), 0, back - 0.02], frame, undefined, 0.35));
    const rungs = sp.rungs ?? 5;
    for (let i = 0; i < rungs; i++) {
      const y = -H / 2 + 0.07 + (i * (H - 0.14)) / (rungs - 1);
      parts.push(
        <mesh key={`rg${i}`} position={[0, y, back - 0.055]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, w - 0.05, 8]} />
          <Mat color={frame} rough={0.3} metal={metal} />
        </mesh>,
      );
    }
    // towel draped over a rung near the middle
    parts.push(box('tfold', [towelW, 0.05, 0.08], [w * 0.1, 0.085, back - 0.055], a, undefined, 0.9));
    parts.push(box('tflap', [towelW, 0.34, 0.018], [w * 0.1, -0.11, back - 0.09], a, undefined, 0.9));
    parts.push(box('tback', [towelW, 0.3, 0.016], [w * 0.1, -0.09, back - 0.02], towel2, undefined, 0.9));
  } else if (style === 'ring') {
    parts.push(
      <mesh key="plate" position={[0, 0.08, back - 0.005]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.016, 14]} />
        <Mat color={frame} rough={0.3} metal={metal} />
      </mesh>,
    );
    parts.push(box('stem', [0.016, 0.016, 0.05], [0, 0.06, back - 0.03], frame, undefined, 0.4));
    parts.push(
      <mesh key="ring" position={[0, -0.04, barZ]} castShadow>
        <torusGeometry args={[w * 0.36, 0.011, 8, 26]} />
        <Mat color={frame} rough={0.3} metal={metal} />
      </mesh>,
    );
    parts.push(box('tg', [0.15, 0.1, 0.05], [0, -0.07, barZ], a, undefined, 0.9));
    parts.push(box('tb', [0.17, 0.26, 0.03], [0, -0.22, barZ], a, undefined, 0.9));
  } else if (style === 'shelf') {
    parts.push(
      <mesh key="shelf" position={[0, 0.13, back - 0.06]} castShadow>
        <boxGeometry args={[w, 0.018, d * 0.95]} />
        <meshPhysicalMaterial color="#e2edf2" transmission={0.9} thickness={0.03} roughness={0.06} />
      </mesh>,
    );
    for (const s of [-1, 1])
      parts.push(box(`br${s}`, [0.014, 0.014, d * 0.8], [s * (w / 2 - 0.05), 0.1, back - 0.05], frame, undefined, 0.4));
    const stack = sp.stack ?? 2;
    for (let i = 0; i < stack; i++)
      parts.push(
        box(`ft${i}`, [w * 0.55, 0.05, d * 0.5], [(i % 2) * w * 0.06 - w * 0.03, 0.165 + i * 0.052, back - 0.06], i % 2 ? towel2 : a, undefined, 0.9),
      );
    parts.push(
      <mesh key="rail" position={[0, -0.05, barZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, w - 0.06, 8]} />
        <Mat color={frame} rough={0.3} metal={metal} />
      </mesh>,
    );
    parts.push(...hangTowel('rt', w * 0.2, barZ, a, 0.36));
  } else {
    // hooks
    parts.push(box('hrail', [w, 0.03, 0.03], [0, 0.04, back - 0.015], frame, undefined, 0.4));
    const n = sp.hooks ?? 3;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / (n + 1)) * (i + 1);
      xs.push(x);
      parts.push(box(`hk${i}`, [0.016, 0.05, 0.05], [x, 0.0, back - 0.04], frame, undefined, 0.4));
      parts.push(box(`hp${i}`, [0.016, 0.016, 0.035], [x, -0.028, back - 0.06], frame, undefined, 0.4));
    }
    parts.push(box('ht', [0.17, 0.36, 0.03], [xs[0], -0.22, back - 0.065], a, undefined, 0.9));
  }
  return <group>{parts}</group>;
}

/** Wall mirror with a reflective face and optional integrated LED strip. */
function VanityMirror({ f }: { f: FurnItem }) {
  const { w, d } = f;
  const sp = f.spec;
  const back = d / 2;
  const H = vamirrorH(f);
  const frameC = sp.black ? '#262a33' : f.color;
  const frameMetal = sp.wood ? 0.1 : sp.black ? 0.4 : 0.6;
  const parts: React.ReactNode[] = [];
  const face = <meshStandardMaterial map={mirrorTexture()} color="#ffffff" roughness={0.1} metalness={0.3} />;
  const style = sp.style ?? 'rect';

  if (style === 'round') {
    const R = w / 2;
    parts.push(
      <mesh key="frm" position={[0, 0, back - 0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[R + 0.02, R + 0.02, 0.03, 32]} />
        <Mat color={frameC} rough={0.35} metal={frameMetal} />
      </mesh>,
    );
    parts.push(
      <mesh key="face" position={[0, 0, back - 0.036]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, 0.02, 32]} />
        {face}
      </mesh>,
    );
  } else if (style === 'pill') {
    const capR = w / 2;
    const bodyH = H - w / 2;
    parts.push(box('frm', [w + 0.035, bodyH, 0.03], [0, -w / 4, back - 0.015], frameC, undefined, 0.35));
    parts.push(
      <mesh key="frc" position={[0, H / 2 - capR, back - 0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[capR + 0.0175, capR + 0.0175, 0.03, 26]} />
        <Mat color={frameC} rough={0.35} metal={frameMetal} />
      </mesh>,
    );
    parts.push(
      <mesh key="faceb" position={[0, -w / 4, back - 0.036]}>
        <boxGeometry args={[w, bodyH - 0.01, 0.02]} />
        {face}
      </mesh>,
    );
    parts.push(
      <mesh key="facec" position={[0, H / 2 - capR, back - 0.036]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[capR - 0.01, capR - 0.01, 0.02, 26]} />
        {face}
      </mesh>,
    );
    if (sp.led) {
      parts.push(glowBox('led', [w * 0.6, 0.02, 0.014], [0, H - 0.014, back - 0.048], '#eaf4ff', 2.4));
      parts.push(<pointLight key="pl" position={[0, 0, back - 0.3]} intensity={0.28} distance={2.2} color="#e8f2ff" castShadow={false} />);
    }
  } else {
    const led = style === 'led';
    const frD = sp.cabinet ? Math.max(d - 0.01, 0.05) : 0.03;
    parts.push(box('frm', [w + 0.03, H + 0.03, frD], [0, 0, back - frD / 2], frameC, undefined, sp.cabinet ? 0.5 : 0.35));
    parts.push(
      <mesh key="face" position={[0, 0, back - frD - 0.011]}>
        <boxGeometry args={[w, H, 0.02]} />
        {face}
      </mesh>,
    );
    if (sp.cabinet) {
      parts.push(box('handle', [0.016, Math.min(0.2, H * 0.3), 0.02], [w / 2 - 0.04, 0, back - frD - 0.03], frameC, undefined, 0.4));
    }
    if (led) {
      const zb = back - frD - 0.024;
      parts.push(glowBox('lt', [w * 0.9, 0.02, 0.014], [0, H / 2 - 0.012, zb], '#eaf4ff', 2.4));
      parts.push(glowBox('lb', [w * 0.9, 0.02, 0.014], [0, -H / 2 + 0.012, zb], '#eaf4ff', 2.4));
      parts.push(glowBox('ll', [0.02, H * 0.86, 0.014], [-w / 2 + 0.012, 0, zb], '#eaf4ff', 2.4));
      parts.push(glowBox('lr', [0.02, H * 0.86, 0.014], [w / 2 - 0.012, 0, zb], '#eaf4ff', 2.4));
      parts.push(<pointLight key="pl" position={[0, 0, back - 0.3]} intensity={0.28} distance={2.2} color="#e8f2ff" castShadow={false} />);
    }
  }
  return <group>{parts}</group>;
}

// ------------------------------------------------------------------ wrapper
export function FurnitureBody({ item }: { item: FurnItem }) {
  switch (item.type) {
    case 'seating':
      return ['sofa', 'sectional', 'loveseat', 'daybed'].includes(item.kind) ? (
        <Sofa f={item} />
      ) : (
        <Chair f={item} />
      );
    case 'tables':
      return <Table f={item} />;
    case 'storage':
      return <Casegood f={item} />;
    case 'beds':
      return <Bed f={item} />;
    case 'ceilight':
      return <CeilingLight f={item} />;
    case 'walllight':
      return <WallLight f={item} />;
    case 'floorlamp':
      return <Lamp f={item} />;
    case 'archlight':
      return <ArchLight f={item} />;
    case 'floorplants':
    case 'trees':
    case 'tableplants':
    case 'succulents':
      return <Plant f={item} />;
    case 'hangingplants':
      return <HangingPlant f={item} />;
    case 'textiles':
      if (item.spec.rug) return <Rug f={item} />;
      if (item.mount === 'wall') return <Curtain f={item} />;
      return <SoftGoods f={item} />;
    case 'walldecor':
      return <WallDecor f={item} />;
    case 'tabletop':
      return <Tabletop f={item} />;
    case 'functional':
      return <Functional f={item} />;
    case 'vanity':
      return <Vanity f={item} />;
    case 'bathtub':
      return <Bathtub f={item} />;
    case 'shower':
      return <Shower f={item} />;
    case 'toilet':
      return <Toilet f={item} />;
    case 'towelrack':
      return <TowelRack f={item} />;
    case 'vamirror':
      return <VanityMirror f={item} />;
    default:
      return null;
  }
}

/** Invisible raycast target sized to the piece for each mount. */
function Hitbox({ item }: { item: FurnItem }) {
  const w = item.w + 0.06;
  const d = item.d + 0.06;
  if (item.mount === 'wall') {
    const hh = wallHeight(item) + 0.1;
    return (
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w + 0.1, hh, d + 0.3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    );
  }
  if (item.mount === 'ceiling') {
    const drop = item.h || 0.4;
    const hh = drop + 0.4;
    return (
      <mesh position={[0, (drop - 0.35) / 2, 0]}>
        <boxGeometry args={[w + 0.1, hh, d + 0.1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    );
  }
  const flat = !!item.spec.rug;
  const hh = flat ? 0.12 : Math.max(0.35, item.h || 0.6);
  return (
    <mesh position={[0, hh / 2, 0]}>
      <boxGeometry args={[flat ? item.w + 0.04 : w, hh, flat ? item.d + 0.04 : d]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function Furniture({
  p,
  onSelect,
  onMove,
}: {
  p: PlacedItem;
  onSelect: (uid: string) => void;
  onMove: (uid: string, x: number, y: number) => boolean;
}) {
  const item = ITEM_INDEX.get(p.itemId) ?? null;
  const items = useStore((s) => s.items);
  const selected = useStore((s) => s.selected === p.uid);
  const drag = useRef<{ ox: number; oy: number } | null>(null);
  const { gl, controls } = useThree();
  const hit = useRef(new Vector3());

  const viewItem = useMemo<FurnItem | null>(() => {
    if (!item) return null;
    return { ...item, color: item.colors[p.colorIdx] ?? item.color };
  }, [item, p.colorIdx]);

  const baseY = useMemo(() => {
    if (!item) return 0;
    if (item.mount === 'wall') return item.h;
    if (item.mount === 'ceiling') return CEIL_H - (item.h || 0.4);
    if (item.mount === 'surface') return supportAt(items, ITEM_INDEX, p.x, p.y) ?? 0;
    return 0;
  }, [item, items, p.x, p.y]);

  if (!item || !viewItem) return null;
  const facing = (p.rot * Math.PI) / 180;
  const maxDim = Math.max(item.w, item.d);
  const flat = !!item.spec.rug;
  const isWall = item.mount === 'wall';
  const isCeil = item.mount === 'ceiling';

  return (
    <group position={[p.x, baseY, -p.y]} rotation={[0, facing, 0]}>
      <group
        onPointerDown={(e: any) => {
          e.stopPropagation();
          onSelect(p.uid);
          // pause orbiting while an item is being dragged
          if (controls) (controls as any).enabled = false;
          if (e.ray.intersectPlane(FLOOR_PLANE, hit.current)) {
            drag.current = { ox: hit.current.x - p.x, oy: -hit.current.z - p.y };
            try {
              gl.domElement.setPointerCapture?.(e.pointerId);
            } catch {
              /* synthetic or released pointer */
            }
          }
        }}
        onPointerMove={(e: any) => {
          if (!drag.current) return;
          if (e.ray.intersectPlane(FLOOR_PLANE, hit.current)) {
            onMove(p.uid, hit.current.x - drag.current.ox, -hit.current.z - drag.current.oy);
          }
        }}
        onPointerUp={() => {
          drag.current = null;
          if (controls) (controls as any).enabled = true;
        }}
      >
        <Hitbox item={item} />
        <FurnitureBody item={viewItem} />
        {selected &&
          (isWall || isCeil ? (
            <mesh position={[0, 0, isWall ? 0.05 : (item.h || 0.4) / 2 - 0.15]}>
              <boxGeometry
                args={
                  isWall
                    ? [item.w + 0.14, wallHeight(item) + 0.14, item.d + 0.34]
                    : [item.w + 0.14, (item.h || 0.4) + 0.4, item.d + 0.14]
                }
              />
              <meshBasicMaterial color="#4f6df5" transparent opacity={0.2} depthWrite={false} />
            </mesh>
          ) : (
            <mesh position={[0, flat ? 0.035 : 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[maxDim * 0.62 + 0.1, 40]} />
              <meshBasicMaterial color="#4f6df5" transparent opacity={0.22} />
            </mesh>
          ))}
      </group>
    </group>
  );
}
