'use strict';
// Renders assets/icon.png and assets/icon.ico (a dark rounded tile with a light "C3": the 3 is a mirrored B).
// Pure Node, no dependencies: node scripts/make-icon.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SS = 4; // supersampling per axis, for smooth edges

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Glyph in a 64-unit box, same shapes as LOGO_SVG in renderer.js. C = arc open to the right, 3 = two stacked right-hand bowls.
function distToArc(px, py, cx, cy, r, keep) {
  const a = Math.atan2(py - cy, px - cx);
  if (keep(a)) return Math.abs(Math.hypot(px - cx, py - cy) - r);
  return Infinity;
}
function glyphDist(x, y) {
  const X = x * 64, Y = y * 64;
  const rad = (d) => (d * Math.PI) / 180;
  const c = distToArc(X, Y, 25.5, 32, 11, (a) => Math.abs(a) >= rad(45));
  const cap1 = Math.hypot(X - (25.5 + 11 * Math.cos(rad(45))), Y - (32 - 11 * Math.sin(rad(45))));
  const cap2 = Math.hypot(X - (25.5 + 11 * Math.cos(rad(45))), Y - (32 + 11 * Math.sin(rad(45))));
  const b1 = distToArc(X, Y, 43.5, 26, 6, (a) => Math.abs(a) <= Math.PI / 2);
  const b2 = distToArc(X, Y, 43.5, 38, 6, (a) => Math.abs(a) <= Math.PI / 2);
  const bars = [[37.5, 20, 43.5, 20], [39.5, 32, 43.5, 32], [37.5, 44, 43.5, 44]].map(([ax, ay, bx, by]) => distToSegment(X, Y, ax, ay, bx, by));
  return Math.min(c, cap1, cap2, b1, b2, ...bars) / 64;
}

function insideRoundRect(x, y, m, r) {
  const lo = m, hi = 1 - m;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const cx = Math.min(Math.max(x, lo + r), hi - r);
  const cy = Math.min(Math.max(y, lo + r), hi - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const stroke = 0.07;

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let tile = 0, glyph = 0, top = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = (i + (si + 0.5) / SS) / size;
          const y = (j + (sj + 0.5) / SS) / size;
          if (!insideRoundRect(x, y, 0.04, 0.22)) continue;
          tile++;
          top += y;
          if (glyphDist(x, y) <= stroke / 2) glyph++;
        }
      }
      const n = SS * SS;
      const o = (j * size + i) * 4;
      if (!tile) continue;
      const g = top / tile; // vertical gradient, light to dark
      const shade = 22 - 10 * g; // near-black tile, slightly darker toward the bottom
      const gl = glyph / tile;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(shade * (1 - gl) + 236 * gl);
      px[o + 3] = Math.round((tile / n) * 255);
    }
  }
  return px;
}

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = render(size);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    raw.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ico(sizes) {
  const images = sizes.map((s) => ({ s, data: png(s) }));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const dir = images.map(({ s, data }) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...images.map((i) => i.data)]);
}

const out = path.join(__dirname, '..', 'assets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.png'), png(512));
fs.writeFileSync(path.join(out, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
console.log('Wrote assets/icon.png and assets/icon.ico');
