// Generate a valid 256x256 PNG icon from the SVG (no external deps):
// draws the RoomCraft mark as raw pixels, then re-saves as assets/icon.png.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 256;
const H = 256;

// --- draw into an RGBA buffer ---------------------------------------------
const px = new Uint8Array(W * H * 4);
const set = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
};
const fillRect = (x0, y0, w, h, r, g, b, a = 255) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, r, g, b, a);
};
const strokeRect = (x0, y0, w, h, t, r, g, b) => {
  fillRect(x0, y0, w, t, r, g, b);
  fillRect(x0, y0 + h - t, w, t, r, g, b);
  fillRect(x0, y0, t, h, r, g, b);
  fillRect(x0 + w - t, y0, t, h, r, g, b);
};
const roundedFill = (x0, y0, w, h, rad, r, g, b) => {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const cx = Math.min(Math.max(x, x0 + rad), x0 + w - rad - 1);
      const cy = Math.min(Math.max(y, y0 + rad), y0 + h - rad - 1);
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) set(x, y, r, g, b, 255);
    }
  }
};

// background: rounded indigo tile
roundedFill(0, 0, W, H, 28, 79, 109, 245);
// room outline (white)
strokeRect(48, 76, 160, 104, 8, 255, 255, 255);
// sofa
roundedFill(68, 108, 56, 28, 4, 255, 255, 255);
// armchair
roundedFill(132, 108, 40, 28, 4, 255, 255, 255);
// chair
roundedFill(200, 112, 16, 16, 2, 255, 255, 255);
// coffee table (ellipse)
for (let y = 146; y < 166; y++)
  for (let x = 140; x < 172; x++) {
    const dx = (x - 156) / 16;
    const dy = (y - 156) / 10;
    if (dx * dx + dy * dy <= 1) set(x, y, 255, 255, 255, 230);
  }
// bed
roundedFill(68, 180, 56, 40, 4, 255, 255, 255, 200);
// sparkle
const star = [[128, 58], [131, 70], [143, 70], [133, 78], [135, 90], [128, 82], [121, 90], [123, 78], [113, 70], [125, 70]];
for (let i = 0, n = star.length; i < n; i++) {
  const [ax, ay] = star[i];
  const [bx, by] = star[(i + 1) % n];
  for (let t = 0; t <= 1; t += 0.01) {
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    fillRect(x - 2, y - 2, 5, 5, 255, 215, 0);
  }
}

// --- encode PNG ------------------------------------------------------------
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // colour type RGBA
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: none
  Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(path.join(__dirname, 'assets', 'icon.png'), png);
console.log('wrote assets/icon.png', png.length, 'bytes');