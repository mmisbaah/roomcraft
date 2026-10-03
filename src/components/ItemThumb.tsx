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

/**
 * Resolve the artwork for an item.
 *
 * Category wins over kind: several kinds are ambiguous across categories
 * (`panel` is a wall panel *and* a panelled bed head, `murphy` is a storage
 * wall-bed *and* a bed). Picking the silhouette from the category and then
 * refining it with the kind keeps "Cloud Panel Bed" looking like a bed.
 */
function resolveShape(item: FurnItem): Shape {
  const k = item.kind;

  const byType: Partial<Record<FurnItem['type'], Record<string, Shape>>> = {
    kitchen: KITCHEN_SHAPES,
    dining: DINING_SHAPES,
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