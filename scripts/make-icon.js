'use strict';
// Renders assets/icon.png and assets/icon.ico (a light rounded tile with a dark ">_" prompt).
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

function insideRoundRect(x, y, m, r) {
  const lo = m, hi = 1 - m;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const cx = Math.min(Math.max(x, lo + r), hi - r);
  const cy = Math.min(Math.max(y, lo + r), hi - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const stroke = 0.075;
  const chevron = [[0.33, 0.33, 0.5, 0.5], [0.5, 0.5, 0.33, 0.67]];
  const underscore = [[0.55, 0.67, 0.71, 0.67]];
  const segs = [...chevron, ...underscore];

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
          if (segs.some(([ax, ay, bx, by]) => distToSegment(x, y, ax, ay, bx, by) <= stroke / 2)) glyph++;
        }
      }
      const n = SS * SS;
      const o = (j * size + i) * 4;
      if (!tile) continue;
      const g = top / tile; // vertical gradient, light to dark
      const shade = 240 - 24 * g; // light grey tile, slightly darker toward the bottom
      const gl = glyph / tile;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(shade * (1 - gl) + 17 * gl);
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
