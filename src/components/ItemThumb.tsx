import type { ReactElement } from 'react';
import type { FurnItem } from '../types';

/**
 * Vector thumbnails for library items.
 *
 * Every item is drawn from its `kind` and tinted with its own palette, so all
 * 500 pieces have distinct, recognisable artwork without shipping a single
 * bitmap. Rendering is pure inline SVG, so it costs nothing to download and
 * scales cleanly at any card size.
 *
 * Shapes are drawn in a 120x80 box: a floor line near the bottom, an ellipse
 * shadow under the piece, then the silhouette. `main` is the item colour,
 * `dark`/`light`/`accent` are derived from it (plus `item.accent` where the
 * piece has one) to give depth without any hand-picked second colour.
 */

type Palette = { main: string; dark: string; light: string; accent: string };

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function toRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return [120, 130, 150];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');

/** Mix a colour toward black (t < 0) or white (t > 0). */
function mix(hex: string, t: number): string {
  const [r, g, b] = toRgb(hex);
  if (t < 0) {
    const k = 1 + t;
    return toHex(r * k, g * k, b * k);
  }
  return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/** Relative luminance, used to keep outlines legible on pale or dark colours. */
function isLight(hex: string): boolean {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function palette(item: FurnItem): Palette {
  const main = item.color;
  return {
    main,
    dark: mix(main, -0.28),
    light: mix(main, 0.22),
    accent: item.accent || mix(main, -0.45),
  };
}

// --- shared primitives -------------------------------------------------------

const Shadow = ({ cx = 60, cy = 70, rx = 34 }: { cx?: number; cy?: number; rx?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={5.5} fill="rgba(15,23,42,0.13)" />
);

const Legs = ({ n = 4, w = 3, y = 62, h = 8, xs = [30, 90] }) =>
  xs.map((x, i) => (
    <rect key={i} x={x - w / 2} y={y} width={w} height={h} rx={1.2} fill="#8a7358" />
  ));

/** Outline colour that stays visible on both pale and dark fills. */
const stroke = (p: Palette) => (isLight(p.main) ? 'rgba(30,35,45,0.34)' : 'rgba(0,0,0,0.26)');

interface ShapeProps {
  p: Palette;
  /** item width in metres, used to exaggerate the silhouette for long pieces */
  w: number;
  d: number;
}

// --- seating ------------------------------------------------------------------

function Sofa({ p, w }: ShapeProps) {
  const wide = Math.min(96, 56 + w * 11);
  const x = (120 - wide) / 2;
  const sectional = w > 2.6;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <Legs xs={[x + 8, x + wide - 8]} />
      <rect x={x} y={26} width={wide} height={20} rx={6} fill={p.dark} />
      <rect x={x + 4} y={22} width={wide - 8} height={18} rx={6} fill={p.main} stroke={stroke(p)} />
      {/* seat cushions */}
      {[0, 1, 2].map((i) => {
        const cw = (wide - 16) / 3;
        return (
          <rect
            key={i}
            x={x + 8 + i * cw}
            y={41}
            width={cw - 3}
            height={13}
            rx={4}
            fill={p.light}
          />
        );
      })}
      {/* arms */}
      <rect x={x - 2} y={34} width={11} height={24} rx={5} fill={p.dark} />
      <rect x={x + wide - 9} y={34} width={11} height={24} rx={5} fill={p.dark} />
      {sectional && (
        <rect x={x + wide - 16} y={40} width={22} height={22} rx={5} fill={p.main} stroke={stroke(p)} />
      )}
    </>
  );
}

function Chair({ p, w }: ShapeProps) {
  const wide = Math.min(56, 30 + w * 22);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 6} />
      <Legs xs={[x + 6, x + wide - 6]} y={58} h={12} />
      <rect x={x - 3} y={18} width={wide + 6} height={26} rx={7} fill={p.dark} />
      <rect x={x} y={16} width={wide} height={24} rx={7} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 3} y={42} width={wide - 6} height={14} rx={5} fill={p.light} />
      <rect x={x - 5} y={34} width={8} height={22} rx={4} fill={p.dark} />
      <rect x={x + wide - 3} y={34} width={8} height={22} rx={4} fill={p.dark} />
    </>
  );
}

function Stool({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={20} />
      <Legs xs={[48, 72]} y={52} h={18} />
      <ellipse cx={60} cy={50} rx={21} ry={7} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={47} rx={21} ry={7} fill={p.light} />
    </>
  );
}

function Ottoman({ p, w }: ShapeProps) {
  const wide = Math.min(58, 26 + w * 30);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 3} />
      <Legs xs={[x + 7, x + wide - 7]} y={54} h={10} />
      <rect x={x} y={32} width={wide} height={26} rx={7} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 3} y={29} width={wide - 6} height={16} rx={6} fill={p.light} />
      <path
        d={`M${x + 6} 46 h${wide - 12}`}
        stroke={p.dark}
        strokeWidth={1.4}
        strokeDasharray="4 4"
        opacity={0.6}
      />
    </>
  );
}

function Bench({ p, w }: ShapeProps) {
  const wide = Math.min(92, 44 + w * 34);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <Legs xs={[x + 8, x + wide - 8]} y={50} h={16} w={4} />
      <rect x={x} y={36} width={wide} height={16} rx={5} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 2} y={26} width={wide - 4} height={13} rx={4} fill={p.dark} />
    </>
  );
}

function Cushion({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      <path
        d="M32 56 Q30 34 60 32 Q90 34 88 56 Q60 64 32 56 Z"
        fill={p.main}
        stroke={stroke(p)}
      />
      <path d="M40 46 Q60 40 80 46" stroke={p.dark} strokeWidth={1.6} fill="none" opacity={0.7} />
    </>
  );
}

// --- tables ------------------------------------------------------------------

function Table({ p, w, d }: ShapeProps) {
  const wide = Math.min(94, 40 + w * 20);
  const deep = Math.min(30, 12 + d * 18);
  const x = (120 - wide) / 2;
  const y = 56 - deep / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <Legs xs={[x + 9, x + wide - 9]} y={56} h={14} w={4} />
      <rect x={x} y={y} width={wide} height={deep} rx={5} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 2} y={y + 2} width={wide - 4} height={deep * 0.3} rx={3} fill={p.light} opacity={0.75} />
    </>
  );
}

function RoundTable({ p, d }: ShapeProps) {
  const r = Math.min(32, 14 + d * 20);
  return (
    <>
      <Shadow rx={r + 2} />
      <rect x={57} y={44} width={6} height={22} rx={2} fill="#8a7358" />
      <path d={`M${60 - r * 0.8} 70 h${r * 1.6}`} stroke="#8a7358" strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={60} cy={46} rx={r} ry={r * 0.34} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={43} rx={r} ry={r * 0.3} fill={p.light} />
    </>
  );
}

function Desk({ p, w }: ShapeProps) {
  const wide = Math.min(92, 44 + w * 16);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <Legs xs={[x + 8, x + wide - 8]} y={50} h={16} w={4} />
      <rect x={x} y={32} width={wide} height={16} rx={4} fill={p.main} stroke={stroke(p)} />
      {/* drawer pedestal */}
      <rect x={x + 3} y={48} width={26} height={18} rx={3} fill={p.dark} />
      <path d={`M${x + 8} 54 h16`} stroke={p.light} strokeWidth={2} strokeLinecap="round" />
      <rect x={x + 4} y={24} width={22} height={9} rx={2} fill={p.light} />
    </>
  );
}

// --- beds --------------------------------------------------------------------

function Bed({ p, w }: ShapeProps) {
  const wide = Math.min(94, 56 + w * 8);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={20} width={wide} height={12} rx={4} fill={p.dark} />
      <rect x={x - 3} y={52} width={wide + 6} height={14} rx={4} fill={p.dark} />
      <rect x={x} y={32} width={wide} height={22} rx={5} fill={p.light} />
      {/* duvet fold */}
      <rect x={x} y={42} width={wide} height={12} rx={4} fill={p.main} opacity={0.85} />
      {/* pillows */}
      <rect x={x + 5} y={26} width={20} height={10} rx={4} fill="#ffffff" opacity={0.92} />
      <rect x={x + wide - 25} y={26} width={20} height={10} rx={4} fill="#ffffff" opacity={0.92} />
    </>
  );
}

function Canopy({ p, w }: ShapeProps) {
  const wide = Math.min(88, 52 + w * 7);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 4} />
      <rect x={x - 5} y={18} width={5} height={48} rx={2} fill="#8a7358" />
      <rect x={x + wide} y={18} width={5} height={48} rx={2} fill="#8a7358" />
      <rect x={x - 10} y={14} width={wide + 20} height={8} rx={3} fill={p.accent} opacity={0.55} />
      <Bed p={p} w={w} d={2} />
    </>
  );
}

// --- storage -----------------------------------------------------------------

function Cabinet({ p, w, h = 46 }: ShapeProps & { h?: number }) {
  const wide = Math.min(84, 32 + w * 22);
  const x = (120 - wide) / 2;
  const y = 66 - h;
  const doors = w > 1.6 ? 3 : w > 0.8 ? 2 : 1;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={y} width={wide} height={h} rx={5} fill={p.main} stroke={stroke(p)} />
      {Array.from({ length: doors }, (_, i) => {
        const dw = (wide - 8) / doors;
        return (
          <g key={i}>
            <rect
              x={x + 4 + i * dw}
              y={y + 5}
              width={dw - 4}
              height={h - 10}
              rx={3}
              fill={p.light}
              opacity={0.5}
            />
            <circle cx={x + 4 + i * dw + (dw - 4) / 2} cy={y + h / 2} r={1.8} fill={p.dark} />
          </g>
        );
      })}
    </>
  );
}

function Bookcase({ p, w }: ShapeProps) {
  const wide = Math.min(52, 30 + w * 18);
  const x = (120 - wide) / 2;
  const y = 14;
  const h = 52;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={y} width={wide} height={h} rx={4} fill={p.dark} />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <rect x={x + 3} y={y + 6 + r * 16} width={wide - 6} height={2} fill={p.main} opacity={0.5} />
          {/* books */}
          {[0, 1, 2, 3, 4].map((b) => (
            <rect
              key={b}
              x={x + 5 + b * ((wide - 12) / 5.2)}
              y={y + 6 + r * 16 - 10}
              width={3.2}
              height={10}
              rx={1}
              fill={[p.main, p.accent, p.light][b % 3]}
            />
          ))}
        </g>
      ))}
    </>
  );
}

function Shelf({ p, w }: ShapeProps) {
  const wide = Math.min(92, 40 + w * 18);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={40} width={wide} height={7} rx={2} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 2} y={26} width={wide - 4} height={7} rx={2} fill={p.light} />
      <rect x={x + 12} y={33} width={9} height={7} rx={1.5} fill={p.accent} />
      <circle cx={x + wide - 22} cy={36} r={4.5} fill={p.dark} />
      <rect x={x + wide - 34} y={33} width={6} height={7} rx={1} fill={p.accent} opacity={0.8} />
    </>
  );
}

function Nightstand({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={16} />
      <rect x={44} y={34} width={32} height={30} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={47} y={38} width={26} height={10} rx={2} fill={p.light} opacity={0.55} />
      <rect x={47} y={51} width={26} height={10} rx={2} fill={p.light} opacity={0.55} />
      <circle cx={60} cy={43} r={1.6} fill={p.dark} />
      <circle cx={60} cy={56} r={1.6} fill={p.dark} />
    </>
  );
}

// --- lighting ----------------------------------------------------------------

function Pendant({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} cx={60} cy={72} />
      <rect x={58} y={6} width={4} height={18} fill="#5b6472" />
      <path d="M40 44 L60 24 L80 44 Z" fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={44} rx={20} ry={3.5} fill={p.light} />
      <circle cx={60} cy={52} r={7} fill="#ffe9a8" opacity={0.85} />
    </>
  );
}

function Chandelier({ p }: ShapeProps) {
  return (
    <>
      <rect x={58} y={4} width={4} height={14} fill="#5b6472" />
      <path d="M34 26 h52" stroke={p.dark} strokeWidth={3} strokeLinecap="round" />
      {[-24, -8, 8, 24].map((dx, i) => (
        <g key={i}>
          <rect x={60 + dx - 1} y={26} width={2} height={10} fill={p.dark} />
          <circle cx={60 + dx} cy={42} r={6} fill={p.light} stroke={stroke(p)} />
          <circle cx={60 + dx} cy={42} r={2.4} fill="#fff6d8" />
        </g>
      ))}
      <ellipse cx={60} cy={72} rx={30} ry={4} fill="rgba(15,23,42,0.10)" />
    </>
  );
}

function FloorLamp({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={16} />
      <rect x={58} y={26} width={4} height={38} fill="#5b6472" />
      <ellipse cx={60} cy={66} rx={12} ry={4} fill="#5b6472" />
      <path d="M44 30 L60 10 L76 30 Z" fill={p.main} stroke={stroke(p)} />
      <path d="M47 29 h26" stroke={p.light} strokeWidth={2} />
    </>
  );
}

function TableLamp({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={16} />
      <rect x={52} y={44} width={16} height={18} rx={3} fill={p.main} stroke={stroke(p)} />
      <path d="M40 44 L52 24 L68 24 L80 44 Z" fill={p.light} stroke={stroke(p)} />
      <ellipse cx={60} cy={62} rx={10} ry={3} fill={p.dark} />
    </>
  );
}

function Sconce({ p }: ShapeProps) {
  return (
    <>
      <rect x={22} y={10} width={76} height={60} rx={3} fill="rgba(148,163,184,0.18)" />
      <rect x={56} y={26} width={8} height={26} rx={2} fill={p.dark} />
      <path d="M44 26 h32 l-6 -14 h-20 Z" fill={p.main} stroke={stroke(p)} />
      <circle cx={60} cy={36} r={5} fill="#ffe9a8" opacity={0.9} />
    </>
  );
}

function StripLight({ p }: ShapeProps) {
  return (
    <>
      <rect x={20} y={20} width={80} height={40} rx={3} fill="rgba(148,163,184,0.18)" />
      <rect x={28} y={30} width={64} height={8} rx={4} fill={p.main} />
      <rect x={28} y={44} width={64} height={5} rx={2.5} fill="#fff3c4" opacity={0.9} />
      <path d="M28 52 h64" stroke={p.accent} strokeWidth={2} strokeDasharray="5 5" opacity={0.7} />
    </>
  );
}

// --- plants ------------------------------------------------------------------

function Plant({ p, tall }: ShapeProps & { tall?: boolean }) {
  return (
    <>
      <Shadow rx={18} />
      <path d="M44 50 h32 l-4 20 h-24 Z" fill={p.main} stroke={stroke(p)} />
      <rect x={42} y={46} width={36} height={7} rx={2.5} fill={p.light} />
      {/* fronds */}
      {[-1, -0.45, 0, 0.45, 1].map((k, i) => (
        <path
          key={i}
          d={`M60 48 Q${60 + k * 26} ${tall ? 20 : 32} ${60 + k * 32} ${tall ? 30 : 40}`}
          stroke={p.dark}
          strokeWidth={3.2}
          fill="none"
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}
    </>
  );
}

function Tree({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={20} />
      <rect x={55} y={44} width={10} height={22} rx={2} fill="#8a7358" />
      <circle cx={60} cy={30} r={22} fill={p.main} />
      <circle cx={44} cy={38} r={13} fill={p.light} opacity={0.85} />
      <circle cx={76} cy={36} r={12} fill={p.dark} opacity={0.5} />
    </>
  );
}

function Succulent({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <path d="M46 48 h28 l-3 20 h-22 Z" fill={p.accent} stroke={stroke(p)} />
      {[-1, -0.35, 0.35, 1].map((k, i) => (
        <ellipse
          key={i}
          cx={60 + k * 9}
          cy={44 - Math.abs(k) * 6}
          rx={7}
          ry={11}
          fill={i % 2 ? p.light : p.main}
          transform={`rotate(${k * 32} ${60 + k * 9} ${46})`}
        />
      ))}
    </>
  );
}

function Hanging({ p }: ShapeProps) {
  return (
    <>
      <rect x={30} y={14} width={60} height={4} rx={2} fill="#5b6472" />
      <path d="M42 18 v18 M60 18 v22 M78 18 v18" stroke={p.dark} strokeWidth={2} />
      <circle cx={42} cy={42} r={10} fill={p.main} />
      <circle cx={60} cy={48} r={9} fill={p.light} />
      <circle cx={78} cy={42} r={10} fill={p.dark} opacity={0.85} />
      <path d="M42 52 q-6 10 2 16 M60 57 q-6 10 2 16 M78 52 q6 10 -2 16" stroke={p.main} strokeWidth={2.5} fill="none" />
    </>
  );
}

// --- wall decor --------------------------------------------------------------

function Artwork({ p, w, d }: ShapeProps) {
  const wide = Math.min(84, 28 + w * 20);
  const tall = Math.min(58, 20 + d * 24);
  const x = (120 - wide) / 2;
  const y = (76 - tall) / 2;
  return (
    <>
      <rect x={x - 3} y={y - 3} width={wide + 6} height={tall + 6} rx={3} fill={p.dark} />
      <rect x={x} y={y} width={wide} height={tall} rx={1.5} fill={p.light} />
      <circle cx={x + wide * 0.38} cy={y + tall * 0.4} r={Math.min(wide, tall) * 0.2} fill={p.main} />
      <path
        d={`M${x} ${y + tall} L${x + wide * 0.5} ${y + tall * 0.5} L${x + wide} ${y + tall} Z`}
        fill={p.accent}
        opacity={0.85}
      />
    </>
  );
}

function Mirror({ p, w, d }: ShapeProps) {
  const wide = Math.min(52, 26 + w * 20);
  const tall = Math.min(62, 30 + d * 22);
  const x = (120 - wide) / 2;
  const y = (76 - tall) / 2;
  return (
    <>
      <rect x={20} y={8} width={80} height={64} rx={3} fill="rgba(148,163,184,0.16)" />
      <ellipse cx={60} cy={y + tall / 2} rx={wide / 2 + 4} ry={tall / 2 + 4} fill={p.dark} />
      <ellipse cx={60} cy={y + tall / 2} rx={wide / 2} ry={tall / 2} fill={p.light} />
      {/* reflection sheen */}
      <path
        d={`M${60 - wide / 4} ${y + tall} L${60 - wide / 12} ${y} h${wide / 6} L${60 - wide / 6} ${y + tall} Z`}
        fill="#ffffff"
        opacity={0.5}
      />
    </>
  );
}

function Curtain({ p, w }: ShapeProps) {
  const wide = Math.min(88, 40 + w * 18);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x - 4} y={10} width={wide + 8} height={4} rx={2} fill="#5b6472" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect
          key={i}
          x={x + i * (wide / 7)}
          y={14}
          width={wide / 7 - 1.5}
          height={50}
          rx={2}
          fill={i % 2 ? p.main : p.light}
        />
      ))}
    </>
  );
}

function Tapestry({ p }: ShapeProps) {
  return (
    <>
      <rect x={30} y={12} width={60} height={54} rx={2} fill={p.main} />
      <circle cx={60} cy={34} r={13} fill={p.light} opacity={0.9} />
      <path d="M40 58 q20 -26 40 0" stroke={p.accent} strokeWidth={3} fill="none" />
      <rect x={30} y={66} width={60} height={3} rx={1.5} fill={p.dark} opacity={0.6} />
    </>
  );
}

// --- textiles ----------------------------------------------------------------

function Rug({ p, w, d }: ShapeProps) {
  const wide = Math.min(96, 50 + w * 12);
  const tall = Math.min(46, 22 + d * 16);
  const x = (120 - wide) / 2;
  const y = (72 - tall) / 2 + 2;
  const round = Math.abs(w - d) < 0.3;
  return (
    <g>
      {round ? (
        <ellipse cx={60} cy={y + tall / 2} rx={wide / 2} ry={tall / 2} fill={p.main} stroke={stroke(p)} />
      ) : (
        <rect x={x} y={y} width={wide} height={tall} rx={4} fill={p.main} stroke={stroke(p)} />
      )}
      <rect
        x={x + 5}
        y={y + 5}
        width={wide - 10}
        height={tall - 10}
        rx={3}
        fill="none"
        stroke={p.light}
        strokeWidth={2}
        opacity={0.8}
      />
      <path
        d={`M${x + 8} ${y + tall - 8} q${(wide - 16) / 2} -10 ${wide - 16} 0`}
        stroke={p.accent}
        strokeWidth={2.5}
        fill="none"
        opacity={0.85}
      />
    </g>
  );
}

function Pillow({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <path d="M34 52 Q32 30 60 28 Q88 30 86 52 Q60 60 34 52 Z" fill={p.main} stroke={stroke(p)} />
      <path d="M42 42 Q60 36 78 42" stroke={p.light} strokeWidth={2.5} fill="none" />
      <circle cx={60} cy={46} r={3} fill={p.accent} />
    </>
  );
}

// --- bathroom ----------------------------------------------------------------

function Bathtub({ p }: ShapeProps) {
  return (
    <>
      <ellipse cx={60} cy={70} rx={42} ry={6} fill="rgba(15,23,42,0.12)" />
      <rect x={20} y={30} width={80} height={36} rx={16} fill={p.main} stroke={stroke(p)} />
      <rect x={26} y={35} width={68} height={24} rx={11} fill={p.light} />
      <rect x={88} y={22} width={6} height={16} rx={2} fill="#9aa4b2" />
      <path d="M92 38 q0 8 -8 8" stroke="#9aa4b2" strokeWidth={3} fill="none" />
    </>
  );
}

function Shower({ p }: ShapeProps) {
  return (
    <>
      <rect x={26} y={12} width={68} height={54} rx={5} fill={p.light} opacity={0.55} />
      <rect x={26} y={12} width={68} height={54} rx={5} fill="none" stroke={p.dark} strokeWidth={2.5} />
      <path d="M60 14 v14" stroke="#9aa4b2" strokeWidth={3} />
      <ellipse cx={60} cy={32} rx={10} ry={4} fill="#9aa4b2" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M${44 + i * 6} 38 v6`}
          stroke="#7dd3fc"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
    </>
  );
}

function Toilet({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      <rect x={46} y={14} width={28} height={22} rx={4} fill={p.light} />
      <rect x={42} y={36} width={36} height={10} rx={4} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={52} rx={20} ry={9} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={52} rx={14} ry={5.5} fill={p.light} />
    </>
  );
}

function Vanity({ p, w }: ShapeProps) {
  const wide = Math.min(78, 36 + w * 16);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={36} width={wide} height={30} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={x - 2} y={30} width={wide + 4} height={8} rx={3} fill="#e7e3da" />
      <ellipse cx={60} cy={34} rx={13} ry={4} fill="#dfe6ea" />
      <path d="M60 30 v-8" stroke="#9aa4b2" strokeWidth={2.5} />
      {[0, 1].map((i) => (
        <rect key={i} x={x + 6 + i * (wide / 2 - 4)} y={42} width={wide / 2 - 16} height={16} rx={3} fill={p.light} opacity={0.5} />
      ))}
    </>
  );
}

function TowelRack({ p }: ShapeProps) {
  return (
    <>
      <rect x={20} y={10} width={80} height={60} rx={3} fill="rgba(148,163,184,0.16)" />
      <rect x={34} y={28} width={52} height={4} rx={2} fill="#9aa4b2" />
      <rect x={42} y={32} width={20} height={26} rx={3} fill={p.main} stroke={stroke(p)} />
      <rect x={64} y={32} width={16} height={22} rx={3} fill={p.light} stroke={stroke(p)} />
    </>
  );
}

// --- tabletop decor ----------------------------------------------------------

function Vase({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={16} />
      <path d="M52 28 h16 q6 10 4 22 q-2 14 -12 14 t-12 -14 q-2 -12 4 -22 Z" fill={p.main} stroke={stroke(p)} />
      <path d="M54 34 h12" stroke={p.light} strokeWidth={2} />
      <path d="M60 28 v-8 M60 22 q-8 -2 -10 -8 M60 22 q8 -2 10 -8" stroke={p.dark} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </>
  );
}

function Books({ p, w }: ShapeProps) {
  const n = Math.max(3, Math.min(6, Math.round(w * 4)));
  return (
    <>
      <Shadow rx={26} />
      {Array.from({ length: n }, (_, i) => {
        const bw = 22 / n + 3;
        const y = 58 - i * 5;
        return (
          <rect
            key={i}
            x={60 - 26 + i * (bw + 1.5)}
            y={y}
            width={bw}
            height={6}
            rx={1.5}
            fill={[p.main, p.accent, p.light][i % 3]}
            transform={`rotate(${(i % 2 ? 1 : -1) * 1.5} ${60} ${y})`}
          />
        );
      })}
    </>
  );
}

function Bowl({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      <path d="M34 40 q26 30 52 0 Z" fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={40} rx={26} ry={7} fill={p.light} stroke={stroke(p)} />
      <ellipse cx={60} cy={40} rx={17} ry={4} fill={p.accent} opacity={0.5} />
    </>
  );
}

function Tray({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      <rect x={26} y={44} width={68} height={16} rx={6} fill={p.main} stroke={stroke(p)} />
      <rect x={31} y={47} width={58} height={10} rx={4} fill={p.light} opacity={0.6} />
      <circle cx={48} cy={52} r={4} fill={p.accent} />
      <rect x={56} y={49} width={12} height={6} rx={2} fill={p.dark} opacity={0.7} />
    </>
  );
}

function Candle({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={16} />
      <rect x={54} y={34} width={12} height={30} rx={3} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={34} rx={6} ry={2.5} fill={p.light} />
      <path d="M60 34 v-8 q4 -3 1 -7 q-5 3 -1 7" fill="#ffcf6b" stroke="none" />
      <rect x={52} y={62} width={16} height={5} rx={2} fill={p.dark} />
    </>
  );
}

function Basket({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      <path d="M40 36 h40 l-5 28 h-30 Z" fill={p.main} stroke={stroke(p)} />
      <path d="M44 44 h32 M43 52 h34" stroke={p.light} strokeWidth={2.2} opacity={0.8} />
      <path d="M42 36 q18 -12 36 0" stroke={p.dark} strokeWidth={3} fill="none" />
    </>
  );
}

function Sculpture({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <rect x={50} y={56} width={20} height={10} rx={2} fill={p.dark} />
      <circle cx={60} cy={38} r={16} fill={p.main} stroke={stroke(p)} />
      <path d="M52 32 q8 -8 16 0" stroke={p.light} strokeWidth={3} fill="none" />
      <circle cx={60} cy={38} r={5} fill={p.accent} />
    </>
  );
}

function Decor({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={24} />
      <rect x={46} y={40} width={28} height={24} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={50} y={34} width={20} height={8} rx={3} fill={p.light} />
      <circle cx={60} cy={52} r={5} fill={p.accent} opacity={0.8} />
    </>
  );
}

// --- architectural -----------------------------------------------------------

function Fireplace({ p, w }: ShapeProps) {
  const wide = Math.min(88, 40 + w * 14);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x} y={16} width={wide} height={50} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 3} y={19} width={wide - 6} height={10} rx={2} fill={p.light} opacity={0.6} />
      <rect x={60 - wide * 0.22} y={40} width={wide * 0.44} height={26} rx={3} fill="#2b2b2b" />
      <path d={`M${60 - wide * 0.12} 62 q6 -12 0 -16 q6 4 0 16`} fill="#ff9f43" />
      <rect x={60 - wide * 0.26} y={38} width={wide * 0.52} height={4} rx={2} fill={p.dark} />
    </>
  );
}

function Media({ p, w }: ShapeProps) {
  const wide = Math.min(80, 36 + w * 14);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={28} width={wide} height={34} rx={4} fill={p.dark} />
      <rect x={x + 4} y={32} width={wide - 8} height={20} rx={2} fill="#1f2937" />
      <path d={`M${x + 8} 46 l${wide * 0.2} -8 v16 Z`} fill={p.main} opacity={0.8} />
      <circle cx={60} cy={58} r={2.4} fill={p.light} />
    </>
  );
}

function Panel({ p }: ShapeProps) {
  return (
    <>
      <rect x={24} y={12} width={72} height={56} rx={4} fill={p.main} stroke={stroke(p)} />
      <path d="M24 30 h72 M24 50 h72 M48 12 v56 M72 12 v56" stroke={p.light} strokeWidth={1.6} opacity={0.65} />
      <rect x={24} y={12} width={72} height={56} rx={4} fill="none" stroke={p.dark} strokeWidth={2} />
    </>
  );
}

// --- rule-driven categories: nursery, gym, laundry, office, pantry, outdoor,
// closet. These cover the objects the room rules name that nothing else held,
// so each one needed a silhouette of its own rather than a borrowed chair.

function CribArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={32} />
      <rect x={28} y={44} width={64} height={16} rx={3} fill={p.dark} />
      <rect x={30} y={38} width={60} height={8} rx={3} fill={p.light} />
      {/* slatted sides */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={32 + i * 10} y={26} width={3.4} height={20} fill={p.main} />
      ))}
      <rect x={28} y={24} width={64} height={4} rx={2} fill={p.main} stroke={stroke(p)} />
      <rect x={86} y={26} width={4} height={34} rx={2} fill={p.main} />
      <rect x={28} y={58} width={64} height={4} rx={2} fill={p.main} />
      <rect x={30} y={40} width={60} height={6} rx={3} fill={p.light} stroke={stroke(p)} />
    </>
  );
}

function BunkArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      {[32, 92].map((x) => (
        <rect key={x} x={x} y={16} width={5} height={50} fill={p.main} stroke={stroke(p)} />
      ))}
      {[18, 50].map((y) => (
        <g key={y}>
          <rect x={30} y={y} width={62} height={7} rx={3} fill={p.light} stroke={stroke(p)} />
          <rect x={30} y={y - 5} width={62} height={6} rx={3} fill={p.main} />
        </g>
      ))}
      <rect x={94} y={16} width={4} height={26} fill={p.main} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={38 + i * 14} y={34} width={3} height={18} fill={p.dark} />
      ))}
    </>
  );
}

function BinArt({ p, w }: ShapeProps) {
  const wide = Math.min(56, 36 + w * 14);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2} />
      <path d={`M${x} 34 L${x + wide} 34 L${x + wide - 5} 62 L${x + 5} 62 Z`} fill={p.main} stroke={stroke(p)} />
      <rect x={x - 2} y={30} width={wide + 4} height={6} rx={3} fill={p.light} stroke={stroke(p)} />
      <path d={`M${x + 6} 40 h${wide - 12}`} stroke={p.dark} strokeWidth={2} opacity={0.6} />
    </>
  );
}

function HorseArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <rect x={34} y={46} width={46} height={12} rx={5} fill={p.main} stroke={stroke(p)} />
      <path d="M74 46 l16 -14 l7 6 l-12 12 Z" fill={p.main} stroke={stroke(p)} />
      <rect x={86} y={26} width={16} height={9} rx={4} fill={p.light} stroke={stroke(p)} />
      <circle cx={101} cy={29} r={2} fill={p.dark} />
      <path d="M42 58 q-6 12 -2 20" stroke={p.dark} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <path d="M72 58 q6 12 2 20" stroke={p.dark} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <path d="M34 50 q10 -10 22 -6" stroke={p.accent ?? p.light} strokeWidth={3} fill="none" strokeLinecap="round" />
    </>
  );
}

function MachineArt({ p, w }: ShapeProps) {
  const wide = Math.min(70, 46 + w * 18);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2} />
      <rect x={x} y={58} width={wide} height={12} rx={4} fill={p.dark} stroke={stroke(p)} />
      <rect x={x + 3} y={54} width={wide * 0.62} height={6} rx={3} fill={p.light} />
      <rect x={x + wide - 14} y={24} width={11} height={34} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={x + wide - 16} y={16} width={15} height={12} rx={3} fill={p.light} stroke={stroke(p)} />
      <path d={`M${x + wide - 12} 22 h9`} stroke={p.dark} strokeWidth={2} />
      <rect x={x + 4} y={22} width={6} height={34} rx={3} fill={p.main} stroke={stroke(p)} />
    </>
  );
}

function RackArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      {[26, 90].map((x) => (
        <rect key={x} x={x} y={18} width={6} height={48} fill={p.main} stroke={stroke(p)} />
      ))}
      <rect x={22} y={22} width={78} height={6} rx={3} fill={p.light} stroke={stroke(p)} />
      <rect x={22} y={62} width={78} height={5} rx={2.5} fill={p.light} />
      <rect x={50} y={28} width={22} height={6} rx={3} fill={p.dark} />
    </>
  );
}

function DumbbellArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      {[34, 58].map((y) => (
        <g key={y}>
          <rect x={26} y={y} width={68} height={4} rx={2} fill={p.light} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={32 + i * 16} y={y - 6} width={10} height={4} rx={2} fill={p.main} />
              <rect x={28 + i * 16} y={y - 8} width={5} height={8} rx={2} fill={p.dark} />
              <rect x={41 + i * 16} y={y - 8} width={5} height={8} rx={2} fill={p.dark} />
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

function BallArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={20} />
      <circle cx={60} cy={48} r={22} fill={p.main} stroke={stroke(p)} />
      <path d="M38 48 h44" stroke={p.light} strokeWidth={4} />
      <circle cx={60} cy={48} r={22} fill="none" stroke={p.dark} strokeWidth={2} />
    </>
  );
}

function PunchingBagArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <rect x={18} y={14} width={84} height={5} rx={2.5} fill={p.dark} />
      <path d="M56 19 h8 v6 h-8 Z" fill={p.light} />
      <rect x={48} y={25} width={24} height={44} rx={10} fill={p.main} stroke={stroke(p)} />
      <rect x={48} y={44} width={24} height={4} fill={p.light} opacity={0.7} />
    </>
  );
}

function StepArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <rect x={28} y={48} width={64} height={20} rx={3} fill={p.main} stroke={stroke(p)} />
      <rect x={38} y={32} width={44} height={18} rx={3} fill={p.light} stroke={stroke(p)} />
      <rect x={28} y={64} width={64} height={4} fill={p.dark} opacity={0.5} />
    </>
  );
}

function WasherArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={24} />
      <rect x={36} y={22} width={48} height={48} rx={5} fill={p.main} stroke={stroke(p)} />
      <rect x={40} y={26} width={40} height={10} rx={3} fill={p.light} />
      <circle cx={60} cy={52} r={15} fill={p.dark} />
      <circle cx={60} cy={52} r={10} fill="#9fb6c4" opacity={0.85} />
      <circle cx={78} cy={30} r={2.4} fill={p.accent ?? p.dark} />
    </>
  );
}

function RodArt({ p, w }: ShapeProps) {
  const wide = Math.min(84, 54 + w * 18);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x - 4} y={16} width={5} height={10} fill={p.main} />
      <rect x={x + wide - 1} y={16} width={5} height={10} fill={p.main} />
      <rect x={x} y={22} width={wide} height={4} rx={2} fill={p.light} stroke={stroke(p)} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <path
            d={`M${x + 6 + i * ((wide - 12) / 4)} 26 q-3 4 0 8`}
            stroke={p.dark}
            strokeWidth={1.6}
            fill="none"
          />
          <rect
            x={x + 3 + i * ((wide - 12) / 4)}
            y={34}
            width={13}
            height={28}
            rx={3}
            fill={i % 2 ? p.main : p.light}
            stroke={stroke(p)}
          />
        </g>
      ))}
    </>
  );
}

function IroningArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      <path d="M22 44 L98 30 L102 38 L26 52 Z" fill={p.main} stroke={stroke(p)} />
      <path d="M60 40 L54 64 M60 40 L74 62" stroke={p.dark} strokeWidth={3} strokeLinecap="round" />
      <rect x={70} y={30} width={18} height={5} rx={2.5} fill={p.light} />
    </>
  );
}

function JarArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      {[38, 60, 82].map((x, i) => (
        <g key={x}>
          <rect x={x - 9} y={38} width={18} height={26} rx={4} fill={i % 2 ? p.main : p.light} stroke={stroke(p)} />
          <rect x={x - 10} y={32} width={20} height={7} rx={2.5} fill={p.dark} />
        </g>
      ))}
    </>
  );
}

function CrockArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={16} />
      <rect x={48} y={40} width={24} height={26} rx={5} fill={p.main} stroke={stroke(p)} />
      <rect x={46} y={36} width={28} height={6} rx={3} fill={p.light} />
      {[54, 60, 66].map((x) => (
        <rect key={x} x={x} y={20} width={3.4} height={18} rx={1.7} fill={p.dark} />
      ))}
      <circle cx={60} cy={52} r={5} fill={p.light} opacity={0.8} />
    </>
  );
}

function HookRailArt({ p, w }: ShapeProps) {
  const wide = Math.min(88, 56 + w * 16);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x} y={34} width={wide} height={7} rx={3.5} fill={p.main} stroke={stroke(p)} />
      {[0, 1, 2, 3].map((i) => {
        const hx = x + 8 + i * ((wide - 16) / 3);
        return (
          <g key={i}>
            <path d={`M${hx} 41 v9 q0 5 5 5`} stroke={p.dark} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <circle cx={hx + 5} cy={55} r={2.6} fill={p.light} />
          </g>
        );
      })}
    </>
  );
}

function ShelvingArt({ p, w }: ShapeProps) {
  const wide = Math.min(74, 50 + w * 16);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2} />
      {[x, x + wide - 5].map((sx) => (
        <rect key={sx} x={sx} y={16} width={5} height={52} fill={p.main} stroke={stroke(p)} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={x} y={18 + i * 16} width={wide} height={4} rx={2} fill={p.light} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={x + 5 + (i % 3) * ((wide - 14) / 3)}
          y={4 + Math.floor(i / 3) * 0}
          width={9}
          height={13}
          rx={1.5}
          fill={i % 2 ? p.dark : p.accent ?? p.main}
          opacity={0.9}
        />
      ))}
    </>
  );
}

function ShelfSmallArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={24} />
      {[30, 58].map((sx) => (
        <rect key={sx} x={sx} y={30} width={4} height={34} fill={p.main} stroke={stroke(p)} />
      ))}
      {[30, 46, 62].map((y) => (
        <rect key={y} x={28} y={y} width={36} height={3.5} rx={1.75} fill={p.light} />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={34 + i * 10} y={18} width={7} height={12} rx={2} fill={i % 2 ? p.dark : p.accent ?? p.main} />
      ))}
    </>
  );
}

function FilingArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <rect x={42} y={18} width={36} height={50} rx={3} fill={p.main} stroke={stroke(p)} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={45} y={21 + i * 12} width={30} height={9} rx={2} fill={p.light} />
          <rect x={56} y={24 + i * 12} width={8} height={3} rx={1.5} fill={p.dark} />
        </g>
      ))}
    </>
  );
}

function MonitorArt({ p, w }: ShapeProps) {
  const wide = Math.min(66, 40 + w * 26);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={22} />
      <rect x={x} y={16} width={wide} height={30} rx={4} fill={p.dark} />
      <rect x={x + 3} y={19} width={wide - 6} height={24} rx={2} fill="#cfe3f0" />
      <rect x={x + wide / 2 - 4} y={46} width={8} height={10} fill={p.main} />
      <rect x={x + wide / 2 - 13} y={55} width={26} height={5} rx={2.5} fill={p.main} stroke={stroke(p)} />
    </>
  );
}

function DeskTopArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <rect x={30} y={40} width={60} height={18} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={36} y={32} width={26} height={8} rx={2} fill={p.light} />
      <rect x={68} y={30} width={16} height={10} rx={4} fill={p.light} stroke={stroke(p)} />
      <rect x={30} y={56} width={60} height={4} rx={2} fill={p.dark} opacity={0.5} />
    </>
  );
}

function TrayArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <rect x={32} y={38} width={56} height={20} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={32} y={38} width={56} height={5} rx={2.5} fill={p.light} />
      <path d="M60 38 v20" stroke={p.dark} strokeWidth={2} opacity={0.6} />
      <rect x={36} y={32} width={48} height={7} rx={2} fill={p.light} opacity={0.8} />
    </>
  );
}

function CaddyArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={24} />
      <rect x={38} y={32} width={44} height={28} rx={5} fill={p.main} stroke={stroke(p)} />
      <rect x={42} y={28} width={36} height={7} rx={3} fill={p.light} />
      <rect x={42} y={44} width={36} height={8} rx={2} fill={p.dark} opacity={0.35} />
      <circle cx={60} cy={48} r={2.4} fill={p.light} />
    </>
  );
}

function BoardArt({ p, w }: ShapeProps) {
  const wide = Math.min(76, 48 + w * 22);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x - 3} y={22} width={wide + 6} height={40} rx={4} fill={p.dark} />
      <rect x={x} y={25} width={wide} height={34} rx={2} fill={p.light} />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={x + 6}
          y={32 + i * 9}
          width={wide * (0.62 - i * 0.16)}
          height={3}
          rx={1.5}
          fill={p.main}
          opacity={0.8}
        />
      ))}
    </>
  );
}

function GlobeArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      <circle cx={60} cy={40} r={20} fill="#8fb0c9" stroke={p.dark} strokeWidth={2} />
      <path d="M46 32 q8 6 4 14 q-4 8 6 10 q10 -2 10 -12 q0 -10 -8 -14 Z" fill="#5f8f7f" opacity={0.85} />
      <circle cx={60} cy={40} r={20} fill="none" stroke={p.light} strokeWidth={2.5} />
      <rect x={52} y={62} width={16} height={5} rx={2} fill={p.main} />
      <rect x={58} y={56} width={4} height={8} fill={p.main} />
    </>
  );
}

function BustArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <rect x={44} y={56} width={32} height={10} rx={2} fill={p.dark} />
      <path d="M48 56 q0 -12 12 -12 q12 0 12 12 Z" fill={p.light} />
      <rect x={52} y={36} width={16} height={10} fill={p.light} />
      <ellipse cx={60} cy={28} rx={13} ry={15} fill={p.light} stroke={stroke(p)} />
      <path d="M54 20 q6 -8 12 -2 q-6 -2 -12 2 Z" fill={p.main} />
      <circle cx={55} cy={28} r={1.6} fill={p.dark} />
      <circle cx={65} cy={28} r={1.6} fill={p.dark} />
    </>
  );
}

function LadderArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <path d="M46 16 L40 68 M74 16 L80 68" stroke={p.main} strokeWidth={5} strokeLinecap="round" />
      {[24, 34, 44, 54, 64].map((y) => (
        <rect key={y} x={43 + (y - 16) * 0.03} y={y} width={35} height={3.6} rx={1.8} fill={p.light} />
      ))}
      <circle cx={40} cy={68} r={3.4} fill={p.dark} />
      <circle cx={80} cy={68} r={3.4} fill={p.dark} />
    </>
  );
}

function CanRackArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <rect x={28} y={28} width={64} height={36} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={28} y={44} width={64} height={4} fill={p.light} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <circle
            cx={40 + (i % 3) * 20}
            cy={36 + Math.floor(i / 3) * 18}
            r={7}
            fill={i % 2 ? p.light : p.dark}
            stroke={stroke(p)}
          />
          <circle cx={40 + (i % 3) * 20} cy={36 + Math.floor(i / 3) * 18} r={2.6} fill={p.accent ?? p.light} />
        </g>
      ))}
    </>
  );
}

function LazySusanArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <ellipse cx={60} cy={48} rx={30} ry={11} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={45} rx={24} ry={8} fill={p.light} />
      <ellipse cx={60} cy={44} rx={7} ry={3} fill={p.dark} />
      <path d="M36 44 l-5 -8 M84 44 l5 -8" stroke={p.dark} strokeWidth={3} strokeLinecap="round" />
    </>
  );
}

function CuttingBoardArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <rect x={30} y={38} width={60} height={26} rx={5} fill={p.main} stroke={stroke(p)} />
      <rect x={82} y={44} width={10} height={14} rx={4} fill={p.dark} />
      <circle cx={88} cy={51} r={2.4} fill={p.light} />
      <path d="M38 44 v14 M48 44 v14" stroke={p.light} strokeWidth={2} opacity={0.5} />
    </>
  );
}

function TileArt({ p, w }: ShapeProps) {
  const wide = Math.min(84, 56 + w * 16);
  const x = (120 - wide) / 2;
  const cols = 6;
  const rows = 3;
  return (
    <>
      <rect x={x - 3} y={24} width={wide + 6} height={36} rx={3} fill={p.dark} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4, 5].map((c) => (
          <rect
            key={`${r}${c}`}
            x={x + c * (wide / cols)}
            y={27 + r * (30 / rows)}
            width={wide / cols - 2}
            height={30 / rows - 2}
            rx={1}
            fill={(r + c) % 3 === 0 ? p.main : p.light}
          />
        )),
      )}
    </>
  );
}

function SwingArt({ p, w }: ShapeProps) {
  const wide = Math.min(76, 50 + w * 16);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2} />
      {[x, x + wide - 5].map((sx) => (
        <rect key={sx} x={sx} y={14} width={5} height={52} fill={p.main} stroke={stroke(p)} />
      ))}
      <rect x={x - 4} y={12} width={wide + 8} height={5} rx={2.5} fill={p.main} />
      <rect x={x + 3} y={44} width={wide - 6} height={7} rx={3} fill={p.light} stroke={stroke(p)} />
      <rect x={x + 3} y={30} width={wide - 6} height={6} rx={3} fill={p.light} />
      {[0, 1].map((i) => (
        <path
          key={i}
          d={`M${x + 10 + i * (wide - 26)} 17 v14`}
          stroke={p.dark}
          strokeWidth={1.8}
        />
      ))}
    </>
  );
}

function ChimesArt({ p }: ShapeProps) {
  return (
    <>
      <rect x={18} y={12} width={84} height={4} rx={2} fill={p.dark} />
      <rect x={56} y={16} width={8} height={8} rx={2} fill={p.main} />
      {[46, 56, 66, 76, 50].map((x, i) => (
        <rect
          key={x}
          x={x - 2}
          y={26 + i * 5}
          width={4}
          height={16 + i * 4}
          rx={2}
          fill={i % 2 ? p.light : p.main}
        />
      ))}
      <rect x={52} y={62} width={16} height={12} rx={2} fill={p.light} stroke={stroke(p)} />
    </>
  );
}

function LanternArt({ p }: ShapeProps) {
  return (
    <>
      <rect x={58} y={10} width={4} height={10} fill={p.dark} />
      <ellipse cx={60} cy={42} rx={22} ry={26} fill={p.light} stroke={p.main} strokeWidth={2} />
      <path d="M40 34 h40 M40 50 h40" stroke={p.main} strokeWidth={1.6} opacity={0.7} />
      <rect x={52} y={14} width={16} height={6} rx={2} fill={p.main} />
      <rect x={52} y={64} width={16} height={5} rx={2} fill={p.main} />
    </>
  );
}

function FeederArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      <path d="M36 34 L60 16 L84 34 Z" fill={p.main} stroke={stroke(p)} />
      <rect x={40} y={34} width={40} height={28} rx={4} fill={p.light} stroke={stroke(p)} />
      <circle cx={52} cy={46} r={4} fill={p.dark} />
      <circle cx={68} cy={46} r={4} fill={p.dark} />
      <rect x={60} y={52} width={3} height={14} fill={p.dark} />
      <path d="M52 44 q-8 -6 -14 -2 M68 44 q8 -6 14 -2" stroke={p.dark} strokeWidth={2} fill="none" />
    </>
  );
}

function PlanterArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      <rect x={28} y={44} width={64} height={20} rx={3} fill={p.main} stroke={stroke(p)} />
      <rect x={28} y={44} width={64} height={4} fill={p.light} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <path
            d={`M${38 + i * 11} 44 q-4 -14 2 -22`}
            stroke={p.dark}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx={40 + i * 11} cy={24 + (i % 2) * 6} rx={7} ry={4.5} fill={p.accent ?? p.dark} />
        </g>
      ))}
    </>
  );
}

function ParasolArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={16} />
      <rect x={58} y={26} width={4} height={42} fill={p.main} />
      <path d="M60 14 a34 26 0 0 0 -34 26 h68 a34 26 0 0 0 -34 -26 Z" fill={p.main} stroke={stroke(p)} />
      <path d="M60 14 v26 M42 18 q4 12 4 22 M78 18 q-4 12 -4 22" stroke={p.light} strokeWidth={1.6} fill="none" opacity={0.8} />
    </>
  );
}

function ValetArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      <ellipse cx={60} cy={64} rx={22} ry={6} fill={p.dark} />
      <rect x={57} y={20} width={6} height={44} rx={3} fill={p.main} stroke={stroke(p)} />
      <path d="M36 28 h48" stroke={p.light} strokeWidth={4} strokeLinecap="round" />
      <circle cx={36} cy={30} r={3.4} fill={p.accent ?? p.dark} />
      <circle cx={84} cy={30} r={3.4} fill={p.accent ?? p.dark} />
      <path d="M60 20 q-6 -10 4 -14" stroke={p.light} strokeWidth={3} fill="none" strokeLinecap="round" />
    </>
  );
}

function HangerArt({ p }: ShapeProps) {
  return (
    <>
      <path d="M60 18 q6 0 6 6 q0 5 -5 6" stroke={p.dark} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <path d="M56 30 L28 46 h64 L64 30 Z" fill={p.main} stroke={stroke(p)} />
      <path d="M28 46 h64" stroke={p.light} strokeWidth={3} />
    </>
  );
}

function ShoeRackArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={30} />
      {[28, 30].map((sx) => (
        <rect key={sx} x={sx === 28 ? 28 : 88} y={22} width={4} height={46} fill={p.main} />
      ))}
      {[26, 44, 62].map((y) => (
        <g key={y}>
          <rect x={26} y={y} width={68} height={3.5} rx={1.75} fill={p.light} />
          {[0, 1].map((i) => (
            <rect key={i} x={34 + i * 26} y={y - 8} width={18} height={8} rx={3} fill={i ? p.main : p.dark} stroke={stroke(p)} />
          ))}
        </g>
      ))}
    </>
  );
}

function MailboxArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <rect x={44} y={30} width={34} height={26} rx={9} fill={p.main} stroke={stroke(p)} />
      <rect x={52} y={22} width={18} height={12} rx={5} fill={p.light} stroke={stroke(p)} />
      <rect x={60} y={56} width={5} height={14} fill={p.dark} />
      <rect x={68} y={26} width={12} height={4} rx={2} fill={p.accent ?? p.light} />
    </>
  );
}

function FirePitArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <ellipse cx={60} cy={52} rx={28} ry={14} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={50} rx={21} ry={10} fill="#2f2a24" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={48 + i * 6}
          y={40 + (i % 2) * 5}
          width={4}
          height={16}
          rx={2}
          fill={p.light}
          transform={`rotate(${-24 + i * 16} ${50 + i * 6} ${48 + (i % 2) * 5})`}
        />
      ))}
      <path d="M56 44 q4 -8 8 0 q-4 6 -8 0 Z" fill="#ff9d4d" />
    </>
  );
}

function TrellisArt({ p }: ShapeProps) {
  return (
    <>
      <rect x={30} y={14} width={4} height={56} fill={p.main} />
      <rect x={86} y={14} width={4} height={56} fill={p.main} />
      {[24, 36, 48, 60].map((y) => (
        <rect key={y} x={30} y={y} width={60} height={3.4} rx={1.7} fill={p.light} />
      ))}
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={46 + i * 16} cy={36 + (i % 2) * 18} rx={9} ry={6} fill={p.accent ?? p.dark} opacity={0.9} />
      ))}
    </>
  );
}

function SpeakerArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={20} />
      <rect x={44} y={20} width={32} height={46} rx={4} fill={p.dark} stroke={stroke(p)} />
      <circle cx={60} cy={34} r={8} fill={p.light} />
      <circle cx={60} cy={34} r={3.4} fill={p.dark} />
      <circle cx={60} cy={54} r={11} fill={p.light} />
      <circle cx={60} cy={54} r={4.4} fill={p.dark} />
    </>
  );
}

function RollerArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <rect x={34} y={38} width={52} height={22} rx={11} fill={p.main} stroke={stroke(p)} />
      <rect x={52} y={38} width={16} height={22} fill={p.dark} />
      <rect x={30} y={44} width={6} height={10} rx={2} fill={p.light} />
    </>
  );
}

function CoilArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={22} />
      <ellipse cx={56} cy={48} rx={22} ry={16} fill="none" stroke={p.main} strokeWidth={4} />
      <ellipse cx={60} cy={44} rx={16} ry={11} fill="none" stroke={p.light} strokeWidth={3.4} />
      <rect x={78} y={40} width={5} height={16} rx={2.5} fill={p.dark} />
      <rect x={86} y={40} width={5} height={16} rx={2.5} fill={p.dark} />
    </>
  );
}

function LuggageArt({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={26} />
      <path d="M34 40 L86 40 L86 46 L34 46 Z" fill={p.main} stroke={stroke(p)} />
      {[34, 44, 54, 64, 74].map((x) => (
        <rect key={x} x={x} y={46} width={3} height={20} fill={p.light} />
      ))}
      <path d="M38 66 L46 40 M84 66 L76 40" stroke={p.dark} strokeWidth={3} strokeLinecap="round" />
    </>
  );
}

function Mobile2({ p }: ShapeProps) {
  return (
    <>
      <rect x={57} y={8} width={6} height={8} rx={2} fill={p.dark} />
      <circle cx={60} cy={20} r={6} fill={p.light} stroke={stroke(p)} />
      {[40, 60, 80].map((x, i) => (
        <g key={x}>
          <path d={`M60 20 L${x} 30`} stroke={p.dark} strokeWidth={1.6} />
          <path d={`M${x} 30 v${10 + i * 6}`} stroke={p.dark} strokeWidth={1.4} />
          <circle cx={x} cy={44 + i * 6} r={6 - i} fill={[p.main, p.light, p.accent ?? p.main][i]} stroke={stroke(p)} />
        </g>
      ))}
      <rect x={46} y={62} width={28} height={8} rx={3} fill={p.light} opacity={0.8} />
    </>
  );
}

function PlateTree2({ p }: ShapeProps) {
  return (
    <>
      <Shadow rx={18} />
      <rect x={57} y={20} width={6} height={46} rx={3} fill={p.main} stroke={stroke(p)} />
      <rect x={44} y={64} width={32} height={6} rx={3} fill={p.dark} />
      {[26, 38, 50].map((y, i) => (
        <g key={y}>
          <rect x={63} y={y} width={4} height={3} fill={p.light} />
          <ellipse cx={76} cy={y + 1.5} rx={4 + i} ry={13 - i * 2} fill={i % 2 ? p.main : p.dark} stroke={stroke(p)} />
        </g>
      ))}
      <ellipse cx={44} cy={30} rx={4} ry={12} fill={p.dark} stroke={stroke(p)} />
    </>
  );
}

function NightlightArt({ p }: ShapeProps) {
  return (
    <>
      <rect x={40} y={28} width={40} height={30} rx={8} fill={p.main} stroke={stroke(p)} />
      <circle cx={60} cy={43} r={10} fill="#ffe9a8" />
      <circle cx={60} cy={43} r={16} fill="#ffe9a8" opacity={0.35} />
      <rect x={52} y={60} width={16} height={8} rx={3} fill={p.dark} />
    </>
  );
}

// --- kind -> shape -----------------------------------------------------------

type Shape = (props: ShapeProps) => ReactElement;

const SEATING_WIDE: Record<string, Shape> = {
  sofa: Sofa,
  loveseat: Sofa,
  sectional: Sofa,
  daybed: Sofa,
  chaise: Sofa,
  recliner: Sofa,
  swing: Sofa,
  murphy: Cabinet,
  nested: Cabinet,
};

const SEATING_ONE: Record<string, Shape> = {
  armchair: Chair,
  accent: Chair,
  dining: Chair,
  bench: Bench,
  office: Chair,
  stool: Stool,
  zz: Stool,
};

const TABLES: Record<string, Shape> = {
  coffee: Table,
  table: Table,
  dining: Table,
  desk: Desk,
  console: Table,
  side: Nightstand,
  pedestal: RoundTable,
  buffet: Cabinet,
  credenza: Cabinet,
  sideboard: Cabinet,
};

const BEDS: Record<string, Shape> = {
  platform: Bed,
  sleigh: Bed,
  canopy: Canopy,
};

const STORAGE: Record<string, Shape> = {
  bookcase: Bookcase,
  shelving: Bookcase,
  cabinet: Cabinet,
  chest: Cabinet,
  dresser: Cabinet,
  armoire: Cabinet,
  wardrobe: Cabinet,
  nightstand: Nightstand,
  shelf: Shelf,
};

const LAMPS: Record<string, Shape> = {
  pendant: Pendant,
  chandelier: Chandelier,
  floor: FloorLamp,
  sconce: Sconce,
  shade: TableLamp,
  uplight: TableLamp,
  table: TableLamp,
  ledstrip: StripLight,
  undercab: StripLight,
  track: StripLight,
  cove: StripLight,
  recessed: StripLight,
  flush: StripLight,
};

const PLANTS: Record<string, Shape> = {
  monstera: Plant,
  palm: Plant,
  ficus: Plant,
  olive: Plant,
  fern: Plant,
  snake: Plant,
  aloe: Plant,
  cactus: Plant,
  lily: Plant,
  citrus: Plant,
  dracaena: Plant,
  evergreen: Plant,
  fiddle: Plant,
  cove: Plant,
};

const SUCCULENTS: Record<string, Shape> = {
  echeveria: Succulent,
  haworthia: Succulent,
  jade: Succulent,
  burro: Succulent,
};

const HANGING: Record<string, Shape> = {
  pothos: Hanging,
  ivy: Hanging,
  philodendron: Hanging,
  calathea: Hanging,
};

const TREES: Record<string, Shape> = {
  zz_tree: Tree,
};

const WALL: Record<string, Shape> = {
  artwork: Artwork,
  picture: Artwork,
  canvas: Artwork,
  tapestry: Tapestry,
  mirror: Mirror,
  curtain: Curtain,
  blind: Curtain,
  panel: Panel,
  wallpaper: Panel,
  divider: Panel,
};

const TEXTILES: Record<string, Shape> = {
  arearug: Rug,
  roundrug: Rug,
  runner: Rug,
  tablerunner: Rug,
  throw: Pillow,
  pillow: Pillow,
  seatcushion: Cushion,
  floorcushion: Cushion,
  polka: Rug,
};

const BATH: Record<string, Shape> = {
  bathtub: Bathtub,
  shower: Shower,
  toilet: Toilet,
  vanity: Vanity,
  towelrack: TowelRack,
};

const DECOR: Record<string, Shape> = {
  vase: Vase,
  bowl: Bowl,
  books: Books,
  bookends: Books,
  candle: Candle,
  tray: Tray,
  diffuser: Vase,
  pearls: Decor,
  basket: Basket,
  box: Decor,
  umbrella: Decor,
  clock: Artwork,
  sculpture: Sculpture,
  art: Artwork,
};

const ARCH: Record<string, Shape> = {
  fireplace: Fireplace,
  media: Media,
  laundry: Cabinet,
  functional: Cabinet,
  cove_arch: Panel,
};

// --- kitchen ---------------------------------------------------------------

/** A worktop: a slab on a plinth, with doors or drawers in the front. */
function Counter({ p, w, d }: ShapeProps) {
  const wide = Math.min(96, 34 + w * 30);
  const x = (120 - wide) / 2;
  const deep = Math.min(34, 16 + d * 22);
  const y = 68 - deep - 4;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x + 3} y={62} width={wide - 6} height={7} rx={1} fill={p.accent} opacity={0.5} />
      <rect x={x} y={y} width={wide} height={deep} rx={2} fill={p.main} stroke={stroke(p)} />
      {/* worktop overhangs the carcass */}
      <rect x={x - 2} y={y - 4} width={wide + 4} height={5} rx={2} fill="#e6e9ee" />
      {(() => {
          const n = Math.max(1, Math.round(wide / 26));
          const dw = (wide - 8) / n - 4;
          return Array.from({ length: n }, (_, i) => (
            <rect
              key={i}
              x={x + 4 + i * (dw + 4)}
              y={y + 4}
              width={dw}
              height={deep - 8}
              rx={2}
              fill={p.light}
              opacity={0.55}
            />
          ));
        })()}
    </>
  );
}

/** Base cabinet run with a sink and tap — the kitchen's most recognisable piece. */
function SinkUnit({ p, w, d }: ShapeProps) {
  const wide = Math.min(96, 34 + w * 30);
  const x = (120 - wide) / 2;
  const deep = Math.min(34, 16 + d * 22);
  const y = 68 - deep - 4;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={y} width={wide} height={deep} rx={2} fill={p.main} stroke={stroke(p)} />
      <rect x={x - 2} y={y - 4} width={wide + 4} height={5} rx={2} fill="#e6e9ee" />
      <rect x={60 - wide * 0.2} y={y - 2} width={wide * 0.4} height={deep * 0.55} rx={2} fill="#c3cbd4" />
      <rect x={60 - wide * 0.17} y={y - 1} width={wide * 0.34} height={deep * 0.42} rx={2} fill="#9aa4b2" />
      <rect x={58} y={y - 18} width={4} height={16} rx={2} fill="#8a8f99" />
      <rect x={58} y={y - 20} width={14} height={3.5} rx={1.75} fill="#8a8f99" />
    </>
  );
}

function Appliance({ p, w, d }: ShapeProps) {
  const wide = Math.min(52, 24 + w * 22);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={12} width={wide} height={56} rx={3} fill={p.main} stroke={stroke(p)} />
      {/* door split + long vertical handles either side of it */}
      <rect x={x + 2} y={14} width={wide / 2 - 3} height={40} rx={2} fill={p.light} opacity={0.5} />
      <rect x={x + wide / 2 + 1} y={14} width={wide / 2 - 3} height={40} rx={2} fill={p.light} opacity={0.5} />
      <rect x={60 - 4} y={20} width={3} height={26} rx={1.5} fill="#9aa4b2" />
      <rect x={60 + 1} y={20} width={3} height={26} rx={1.5} fill="#9aa4b2" />
      <rect x={x + 3} y={55} width={wide - 6} height={10} rx={2} fill={p.accent} opacity={0.6} />
    </>
  );
}

function Range({ p, w, d }: ShapeProps) {
  const wide = Math.min(56, 30 + w * 26);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={28} width={wide} height={40} rx={3} fill={p.main} stroke={stroke(p)} />
      {/* oven door with dark glass */}
      <rect x={x + 4} y={38} width={wide - 8} height={22} rx={2} fill="#2b3138" />
      <rect x={x + 4} y={33} width={wide - 8} height={3} rx={1.5} fill="#9aa4b2" />
      {/* hob with burner rings */}
      <rect x={x - 2} y={22} width={wide + 4} height={7} rx={2} fill="#22262c" />
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          cx={x + 8 + (i % 2) * (wide - 16)}
          cy={25.5}
          r={3.4}
          fill="none"
          stroke="#8a8f99"
          strokeWidth={1.2}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={x + 7 + (i % 2) * (wide - 14)} cy={65} r={1.8} fill="#9aa4b2" />
      ))}
    </>
  );
}

function Hood({ p, w, d }: ShapeProps) {
  const wide = Math.min(56, 28 + w * 26);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={20} y={8} width={80} height={64} rx={3} fill="rgba(148,163,184,0.18)" />
      <rect x={60 - 4} y={10} width={8} height={16} rx={1} fill={p.accent} opacity={0.6} />
      <path d={`M${x} 42 L${60 - 8} 26 L${60 + 8} 26 L${x + wide} 42 Z`} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 2} y={42} width={wide - 4} height={4} rx={1.5} fill="#8a8f99" />
      <rect x={x + 6} y={30} width={wide - 12} height={2.5} rx={1.25} fill="#fff3c4" />
    </>
  );
}

function Cart({ p, w, d }: ShapeProps) {
  const wide = Math.min(60, 30 + w * 30);
  const x = (120 - wide) / 2;
  const deep = Math.min(30, 14 + d * 26);
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      {[0, 1].map((i) => (
        <rect key={i} x={x} y={30 + i * 22} width={wide} height={4} rx={1.5} fill={i ? p.light : p.main} stroke={stroke(p)} />
      ))}
      <rect x={x + 2} y={34} width={wide - 4} height={18} rx={2} fill={p.main} stroke={stroke(p)} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={x + 5 + (i % 2) * (wide - 16)}
          y={50}
          width={3}
          height={14}
          rx={1.5}
          fill="#8a8f99"
        />
      ))}
      {[0, 1].map((i) => (
        <circle key={i} cx={x + 6.5 + i * (wide - 13)} cy={66} r={3.4} fill="#3d405b" />
      ))}
    </>
  );
}

// --- dining ----------------------------------------------------------------

function DiningTable({ p, w, d }: ShapeProps) {
  const wide = Math.min(94, 44 + w * 22);
  const deep = Math.min(36, 18 + d * 18);
  const x = (120 - wide) / 2;
  const y = 42;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={y} width={wide} height={deep} rx={4} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 3} y={y + 3} width={wide - 6} height={deep * 0.3} rx={2} fill={p.light} opacity={0.6} />
      {/* chairs pulled up around it */}
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={x + 8 + i * (wide - 20)} y={y - 9} width={11} height={9} rx={2.5} fill={p.accent} opacity={0.8} />
          <rect x={x + 8 + i * (wide - 20)} y={y + deep} width={11} height={9} rx={2.5} fill={p.accent} opacity={0.8} />
        </g>
      ))}
    </>
  );
}

function RoundDining({ p, w }: ShapeProps) {
  const r = Math.min(34, 18 + w * 14);
  return (
    <>
      <Shadow rx={r + 2} />
      <rect x={57} y={48} width={6} height={18} rx={2} fill={p.accent} />
      <path d={`M${60 - r * 0.7} 70 h${r * 1.4}`} stroke={p.accent} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={60} cy={44} rx={r} ry={r * 0.36} fill={p.main} stroke={stroke(p)} />
      <ellipse cx={60} cy={41} rx={r} ry={r * 0.32} fill={p.light} />
    </>
  );
}

function Sideboard({ p, w, d }: ShapeProps) {
  const wide = Math.min(90, 36 + w * 28);
  const x = (120 - wide) / 2;
  const deep = Math.min(28, 14 + d * 20);
  const y = 66 - deep - 6;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x + 4} y={64} width={wide - 8} height={5} rx={1} fill={p.accent} opacity={0.5} />
      <rect x={x} y={y} width={wide} height={deep} rx={3} fill={p.main} stroke={stroke(p)} />
      <rect x={x - 2} y={y - 4} width={wide + 4} height={4} rx={1.5} fill="#e6e9ee" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={x + 5 + i * ((wide - 10) / 3)}
            y={y + 4}
            width={(wide - 10) / 3 - 4}
            height={deep - 8}
            rx={2}
            fill={p.light}
            opacity={0.55}
          />
          <circle cx={x + 5 + i * ((wide - 10) / 3) + ((wide - 10) / 3 - 4) / 2} cy={y + deep / 2} r={1.6} fill={p.dark} />
        </g>
      ))}
    </>
  );
}

function ChinaCabinet({ p, w, d }: ShapeProps) {
  const wide = Math.min(54, 28 + w * 26);
  const x = (120 - wide) / 2;
  const deep = Math.min(26, 12 + d * 18);
  const y = 66 - deep - 10;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={y} width={wide} height={deep} rx={3} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 2} y={y - 24} width={wide - 4} height={22} rx={2} fill="#cfe8f0" stroke={stroke(p)} />
      {[0, 1].map((i) => (
        <rect key={i} x={x + 5} y={y - 18 + i * 8} width={wide - 10} height={2} rx={1} fill={p.accent} opacity={0.6} />
      ))}
      <circle cx={60} cy={y - 13} r={3.4} fill="#e8e3d9" />
      <rect x={x + 2} y={y + 4} width={wide - 4} height={deep - 8} rx={2} fill={p.light} opacity={0.5} />
    </>
  );
}

function WineRack({ p, w, d }: ShapeProps) {
  const wide = Math.min(50, 26 + w * 30);
  const x = (120 - wide) / 2;
  const deep = Math.min(28, 14 + d * 24);
  const y = 66 - deep;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={y} width={wide} height={deep} rx={2} fill={p.dark} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((b) => (
          <circle
            key={`${r}${b}`}
            cx={x + 8 + b * ((wide - 16) / 2)}
            cy={y + 6 + r * ((deep - 10) / 2)}
            r={2.8}
            fill={['#2f4f3a', '#3a2b4a', '#4a2b2b'][(r + b) % 3]}
          />
        )),
      )}
      <rect x={x} y={y} width={wide} height={deep} rx={2} fill="none" stroke={p.main} strokeWidth={2.5} />
    </>
  );
}

function Bench2({ p, w, d }: ShapeProps) {
  const wide = Math.min(88, 40 + w * 30);
  const x = (120 - wide) / 2;
  return (
    <>
      <Shadow rx={wide / 2 + 2} />
      <rect x={x} y={42} width={wide} height={9} rx={3} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 2} y={51} width={wide - 4} height={5} rx={2} fill={p.light} />
      {[0, 1].map((i) => (
        <rect key={i} x={x + 9 + i * (wide - 18)} y={56} width={5} height={13} rx={2} fill={p.accent} />
      ))}
    </>
  );
}

const KITCHEN_SHAPES: Record<string, Shape> = {
  basecab: Counter,
  drawerbank: Counter,
  island: Counter,
  peninsula: Counter,
  cart: Cart,
  sinkbase: SinkUnit,
  fridge: Appliance,
  freezer: Appliance,
  range: Range,
  cooktop: Range,
  hood: Hood,
  dishwasher: Appliance,
  microwave: Appliance,
  wallcab: Counter,
  pantry: Counter,
  recycle: Counter,
};

const DINING_SHAPES: Record<string, Shape> = {
  dining: DiningTable,
  trestle: DiningTable,
  bar: DiningTable,
  oval: DiningTable,
  banquet: DiningTable,
  round: RoundDining,
  buffet: Sideboard,
  console: Sideboard,
  serving: Cart,
  barcart: Cart,
  china: ChinaCabinet,
  winerack: WineRack,
  platerack: Counter,
  etagere: Counter,
  bench: Bench2,
};

const NURSERY_SHAPES: Record<string, Shape> = {
  crib: CribArt,
  bassinet: CribArt,
  bunk: BunkArt,
  changing: Counter,
  glider: Chair,
  pail: BinArt,
  mobile: Mobile2,
  canopy: Hanging,
  monitor: CaddyArt,
  soundmachine: Decor,
  nightlight: NightlightArt,
  toybasket: BinArt,
  moses: BinArt,
  toybin: Cart,
  pad: Cushion,
  horse: HorseArt,
  starprojector: Decor,
  glowstar: Artwork,
  bunting: Artwork,
  booklight: Sconce,
};

const GYM_SHAPES: Record<string, Shape> = {
  treadmill: MachineArt,
  bike: MachineArt,
  rower: MachineArt,
  squatrack: RackArt,
  cablemachine: RackArt,
  abwheel: RackArt,
  pullup: RackArt,
  weightbench: Bench2,
  dumbbellrack: DumbbellArt,
  kettlebell: DumbbellArt,
  medball: BallArt,
  punchingbag: PunchingBagArt,
  platetree: PlateTree2,
  yogamat: Rug,
  foamroller: RollerArt,
  step: StepArt,
  jumprope: CoilArt,
  bands: CoilArt,
  bottlestation: ShelvingArt,
  soundsystem: SpeakerArt,
};

const LAUNDRY_SHAPES: Record<string, Shape> = {
  washer: WasherArt,
  dryer: WasherArt,
  stackpair: WasherArt,
  foldcounter: Counter,
  utilsink: SinkUnit,
  laundrycab: Counter,
  laundrywall: Counter,
  rod: RodArt,
  dryingrack: RackArt,
  ironingboard: IroningArt,
  iron: Decor,
  clothespin: JarArt,
  detergent: JarArt,
  hamper: BinArt,
  lintbin: BinArt,
  trolley: Cart,
  utilityshelf: ShelvingArt,
  hookrail: HookRailArt,
  boardcover: Decor,
  laundrymat: Rug,
};

const OFFICE_SHAPES: Record<string, Shape> = {
  desk: Desk,
  standing: Desk,
  taskchair: Chair,
  filing: FilingArt,
  monitor: MonitorArt,
  keyboard: DeskTopArt,
  mouse: DeskTopArt,
  footrest: StepArt,
  cabletray: TrayArt,
  organiser: TrayArt,
  doctray: TrayArt,
  tissue: TrayArt,
  printer: CaddyArt,
  wastebasket: BinArt,
  whiteboard: BoardArt,
  pinboard: BoardArt,
  globe: GlobeArt,
  glassesstand: Decor,
  bust: BustArt,
  rollingladder: LadderArt,
};

const PANTRY_SHAPES: Record<string, Shape> = {
  pantryshelf: ShelvingArt,
  pantrycab: Cabinet,
  pantrycart: Cart,
  pantrywine: WineRack,
  stepstool: StepArt,
  clearbin: BinArt,
  canorg: CanRackArt,
  lazysusan: LazySusanArt,
  jarlabels: Decor,
  chalkboard: BoardArt,
  spicerack: ShelfSmallArt,
  breadbox: CaddyArt,
  eggshelf: TrayArt,
  pantrydrawer: Cabinet,
  crate: BinArt,
  apothecary: JarArt,
  crock: CrockArt,
  board: CuttingBoardArt,
  apronhook: HookRailArt,
  backsplash: TileArt,
};

const OUTDOOR_SHAPES: Record<string, Shape> = {
  porchswing: SwingArt,
  rattansofa: Sofa,
  rattanchair: Chair,
  wickertable: Table,
  outdoorside: Table,
  bistro: Table,
  chimes: ChimesArt,
  lantern: LanternArt,
  feeder: FeederArt,
  outdoorrug: Rug,
  doormat: Rug,
  parasol: ParasolArt,
  gardenstool: StepArt,
  planter: PlanterArt,
  trellis: TrellisArt,
  wateringcan: CrockArt,
  hosereel: CaddyArt,
  outdoorbench: Bench2,
  mailbox: MailboxArt,
  firepit: FirePitArt,
};

const CLOSET_SHAPES: Record<string, Shape> = {
  closetshelf: ShelvingArt,
  rod2: RodArt,
  hangerbar: RodArt,
  valet: ValetArt,
  hanger: HangerArt,
  cedar: HangerArt,
  divider: TrayArt,
  jewelorganiser: TrayArt,
  perftray: TrayArt,
  shoerack: ShoeRackArt,
  closetdrawer: FilingArt,
  closetisland: Cabinet,
  fullmirror: Mirror,
  closetlight: StripLight,
  closetbench: Bench2,
  belt: HookRailArt,
  closethook: HookRailArt,
  luggage: LuggageArt,
  hatshelf: ShelfSmallArt,
  basketbin: BinArt,
};

// --- doors ------------------------------------------------------------------
// All twenty read as the same silhouette — a frame with leaves in it — because
// that is what makes a door recognisable at thumbnail size. What differs is
// drawn inside the frame: glazing, a fold line, a track, a push bar.

function DoorArt({ p, w }: ShapeProps) {
  const wide = Math.min(74, 34 + w * 24);
  const x = (120 - wide) / 2;
  const top = 14;
  const bot = 74;
  return (
    <>
      {/* frame */}
      <rect x={x} y={top} width={wide} height={bot - top} fill="#e8e3d9" opacity={0.5} />
      <rect x={x} y={top} width={wide} height={bot - top} fill="none" stroke={p.dark} strokeWidth={4} />
      {/* leaves */}
      <rect x={x + 3} y={top + 4} width={wide - 6} height={bot - top - 8} fill={p.main} stroke={stroke(p)} />
      {/* panel lines */}
      {[0.34, 0.66].map((f) => (
        <rect key={f} x={x + 7} y={top + (bot - top) * f - 1} width={wide - 14} height={2} fill={p.light} opacity={0.9} />
      ))}
      <rect x={60} y={top + 6} width={2} height={bot - top - 12} fill={p.dark} opacity={0.6} />
      {/* handle */}
      <circle cx={x + wide - 10} cy={44} r={2.6} fill="#c9a227" />
    </>
  );
}

function GlazedDoorArt({ p, w, d }: ShapeProps) {
  const wide = Math.min(74, 34 + w * 24);
  const x = (120 - wide) / 2;
  return (
    <>
      <DoorArt p={p} w={w} d={d} />
      <rect x={x + 9} y={20} width={wide - 18} height={40} fill="#cfe3f0" opacity={0.85} />
      <rect x={x + 9} y={20} width={wide - 18} height={40} fill="none" stroke={p.dark} strokeWidth={1.6} />
      <rect x={x + (wide - 18) / 2 + 6} y={20} width={2} height={40} fill={p.dark} opacity={0.7} />
    </>
  );
}

function SlidingDoorArt({ p, w }: ShapeProps) {
  const wide = Math.min(96, 48 + w * 20);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x} y={14} width={wide} height={60} fill="none" stroke={p.dark} strokeWidth={4} />
      <rect x={x + 5} y={18} width={wide / 2 - 6} height={52} fill={p.main} stroke={stroke(p)} />
      <rect x={x + wide / 2 + 1} y={18} width={wide / 2 - 6} height={52} fill={p.light} stroke={stroke(p)} />
      <rect x={x + 7} y={22} width={wide / 2 - 10} height={34} fill="#cfe3f0" opacity={0.8} />
      <rect x={x + wide / 2 + 3} y={22} width={wide / 2 - 10} height={34} fill="#cfe3f0" opacity={0.8} />
      <rect x={x} y={12} width={wide} height={4} rx={2} fill="#8a8f99" />
      <circle cx={x + wide / 2 + 4} cy={50} r={2.4} fill="#c9a227" />
    </>
  );
}

function BarnDoorArt({ p, w }: ShapeProps) {
  const wide = Math.min(80, 40 + w * 22);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x - 6} y={10} width={wide + 12} height={5} rx={2.5} fill="#4a4f57" />
      {[0.25, 0.5, 0.75].map((f) => (
        <rect key={f} x={x + 4} y={20 + f * 46} width={wide - 8} height={2.4} fill={p.dark} opacity={0.7} />
      ))}
      <rect x={x} y={18} width={wide} height={54} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 6} y={24} width={3} height={12} fill="#8a8f99" />
      <rect x={x + wide - 9} y={24} width={3} height={12} fill="#8a8f99" />
      <circle cx={x + wide - 8} cy={52} r={2.8} fill="#c9a227" />
      <path d={`M${x - 6} 22 h6 M${x + wide} 22 h6`} stroke="#4a4f57" strokeWidth={3} />
    </>
  );
}

function RibbedDoorArt({ p, w }: ShapeProps) {
  const wide = Math.min(96, 48 + w * 18);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x} y={14} width={wide} height={60} fill="none" stroke={p.dark} strokeWidth={4} />
      <rect x={x + 3} y={17} width={wide - 6} height={54} fill={p.main} stroke={stroke(p)} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={x + 7} y={22 + i * 12} width={wide - 14} height={5} rx={2.5} fill={p.light} opacity={0.85} />
      ))}
      {wide > 60 && <rect x={60} y={17} width={2} height={54} fill={p.dark} opacity={0.5} />}
    </>
  );
}

function PocketDoorArt({ p, w }: ShapeProps) {
  const wide = Math.min(72, 36 + w * 24);
  const x = (120 - wide) / 2;
  return (
    <>
      {/* the wall the leaf slides into */}
      <rect x={x} y={14} width={wide + 12} height={60} fill={p.dark} opacity={0.16} />
      <rect x={x} y={14} width={wide + 12} height={60} fill="none" stroke={p.dark} strokeWidth={3} strokeDasharray="5 4" />
      <rect x={x + 4} y={19} width={wide - 8} height={50} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 8} y={26} width={wide - 16} height={2} fill={p.light} />
      <circle cx={x + wide - 9} cy={44} r={2.6} fill="#c9a227" />
      <path d={`M${x + 4} 15 h${wide - 8}`} stroke="#8a8f99" strokeWidth={2} strokeDasharray="3 3" />
    </>
  );
}

function FoldDoorArt({ p, w }: ShapeProps) {
  const wide = Math.min(78, 40 + w * 22);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x} y={14} width={wide} height={60} fill="none" stroke={p.dark} strokeWidth={4} />
      {[0, 1, 2, 3].map((i) => {
        const lw = (wide - 8) / 4;
        return (
          <g key={i}>
            <rect
              x={x + 4 + i * lw}
              y={18 + (i % 2) * 4}
              width={lw - 1}
              height={52 - (i % 2) * 8}
              fill={i % 2 ? p.light : p.main}
              stroke={stroke(p)}
            />
          </g>
        );
      })}
    </>
  );
}

function PushDoorArt({ p, w }: ShapeProps) {
  const wide = Math.min(60, 34 + w * 22);
  const x = (120 - wide) / 2;
  return (
    <>
      <rect x={x} y={14} width={wide} height={60} fill="none" stroke={p.dark} strokeWidth={4} />
      <rect x={x + 3} y={17} width={wide - 6} height={54} fill={p.main} stroke={stroke(p)} />
      <rect x={x + 7} y={21} width={wide - 14} height={22} fill="#cfe3f0" opacity={0.85} />
      <rect x={x + 7} y={48} width={wide - 14} height={20} fill="#cfe3f0" opacity={0.85} />
      <rect x={x + 5} y={44} width={wide - 10} height={4} rx={2} fill="#8a8f99" />
    </>
  );
}

const DOOR_SHAPES: Record<string, Shape> = {
  single: DoorArt,
  double: DoorArt,
  reveal: DoorArt,
  flush: DoorArt,
  french: GlazedDoorArt,
  glass: GlazedDoorArt,
  pivot: GlazedDoorArt,
  fire: PushDoorArt,
  sliding: SlidingDoorArt,
  pocket: PocketDoorArt,
  pocket2: PocketDoorArt,
  bifold: FoldDoorArt,
  concertina: FoldDoorArt,
  barn: BarnDoorArt,
  loft: RibbedDoorArt,
  garage: RibbedDoorArt,
  garage2: RibbedDoorArt,
  dutch: DoorArt,
};

/**
 * Resolve the artwork for an item.
 *
 * Category wins over kind: several kinds are ambiguous across categories
 * (`panel` is a wall panel *and* a panelled bed head, `murphy` is a storage
 * wall-bed *and* a bed). Picking the silhouette from the category and then
 * refining it with the kind keeps "Cloud Panel Bed" looking like a bed.
 */
export function resolveShape(item: FurnItem): Shape {
  const k = item.kind;

  const byType: Partial<Record<FurnItem['type'], Record<string, Shape>>> = {
    kitchen: KITCHEN_SHAPES,
    dining: DINING_SHAPES,
    nursery: NURSERY_SHAPES,
    gym: GYM_SHAPES,
    laundry: LAUNDRY_SHAPES,
    office: OFFICE_SHAPES,
    pantry: PANTRY_SHAPES,
    outdoor: OUTDOOR_SHAPES,
    closet: CLOSET_SHAPES,
    doors: DOOR_SHAPES,
    seating: {
      ...SEATING_WIDE,
      ...SEATING_ONE,
      ottoman: Ottoman,
      pouf: Ottoman,
      floorcushion: Cushion,
      seatcushion: Cushion,
      lounge: Sofa,
    },
    tables: {
      ...TABLES,
      side: Nightstand,
      round: RoundTable,
      nesting: Table,
    },
    beds: BEDS,
    storage: {
      ...STORAGE,
      media: Media,
    },
    ceilight: LAMPS,
    walllight: { ...LAMPS, sconce: Sconce },
    floorlamp: LAMPS,
    archlight: LAMPS,
    floorplants: PLANTS,
    tableplants: PLANTS,
    succulents: SUCCULENTS,
    hangingplants: HANGING,
    trees: TREES,
    textiles: TEXTILES,
    walldecor: WALL,
    tabletop: DECOR,
    functional: { ...ARCH, ...DECOR },
    vanity: BATH,
    bathtub: BATH,
    shower: BATH,
    toilet: BATH,
    towelrack: BATH,
    vamirror: { ...WALL, mirror: Mirror },
  };

  const table = byType[item.type];
  const hit = table?.[k];
  if (hit) return hit;

  // Unmapped kind inside a known category: fall back to the category default.
  const fallback: Partial<Record<FurnItem['type'], Shape>> = {
    kitchen: Counter,
    dining: DiningTable,
    seating: Chair,
    tables: Table,
    beds: Bed,
    storage: Cabinet,
    ceilight: Pendant,
    walllight: Sconce,
    floorlamp: FloorLamp,
    archlight: StripLight,
    floorplants: Plant,
    tableplants: Plant,
    succulents: Succulent,
    hangingplants: Hanging,
    trees: Tree,
    textiles: Rug,
    walldecor: Artwork,
    tabletop: Decor,
    functional: Fireplace,
    vanity: Vanity,
    bathtub: Bathtub,
    shower: Shower,
    toilet: Toilet,
    towelrack: TowelRack,
    vamirror: Mirror,
    nursery: CribArt,
    gym: MachineArt,
    laundry: Counter,
    office: Desk,
    pantry: Cabinet,
    outdoor: Chair,
    closet: ShelvingArt,
    doors: DoorArt,
  };
  return fallback[item.type] ?? Decor;
}

/** Soft page-like backdrop so the artwork reads as a product photo. */
function backdrop(main: string): string {
  const [r, g, b] = toRgb(main);
  // Desaturate toward a warm neutral rather than tinting with the item colour,
  // which would make every card look the same.
  const grey = (r + g + b) / 3;
  const t = 0.82;
  const base = toHex(grey + (r - grey) * t, grey + (g - grey) * t, grey + (b - grey) * t);
  return `linear-gradient(160deg, ${mix(base, 0.42)} 0%, ${mix(base, 0.06)} 58%, ${mix(base, -0.12)} 100%)`;
}

export default function ItemThumb({
  item,
  locked = false,
  className,
}: {
  item: FurnItem;
  locked?: boolean;
  className?: string;
}) {
  const Shape = resolveShape(item);
  const p = palette(item);
  // Locked cards desaturate rather than fade, so the piece stays recognisable
  // behind the padlock instead of dissolving into the backdrop.
  const shown: FurnItem = locked
    ? { ...item, color: mix(item.color, -0.12), accent: mix(item.accent, -0.1) }
    : item;
  return (
    <svg
      className={className}
      viewBox="0 0 120 80"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={item.name}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id={`bg-${item.id}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={mix(p.light, 0.55)} />
          <stop offset="60%" stopColor={mix(p.main, 0.66)} />
          <stop offset="100%" stopColor={mix(p.dark, 0.6)} />
        </linearGradient>
        <filter id={`desat-${item.id}`}>
          <feColorMatrix type="saturate" values="0.25" />
        </filter>
      </defs>
      <rect width={120} height={80} fill={`url(#bg-${item.id})`} />
      {/* floor line */}
      <path d="M0 68 H120" stroke="rgba(30,35,45,0.10)" strokeWidth={1} />
      <g opacity={locked ? 0.85 : 1} filter={locked ? `url(#desat-${item.id})` : undefined}>
        {Shape({ p: palette(shown), w: item.w, d: item.d })}
      </g>
    </svg>
  );
}

export { backdrop };