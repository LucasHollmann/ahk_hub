// Renders the app icon and writes the .ico files. No image dependencies: shapes are drawn
// from signed-distance functions with 4x4 supersampling, then encoded as PNG by hand and
// packed into an ICO (Windows reads PNG-compressed icon entries at every size).
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

// Repo root; defaults to the current directory so "npm run icon" just works.
const OUT_DIR = process.argv[2] ?? process.cwd();

// Same accent gradient the app's primary buttons use (--main -> --main-gradient).
const GRADIENT_FROM = [0x22, 0xd3, 0xee];
const GRADIENT_TO = [0x63, 0x66, 0xf1];
const GLYPH = [0xff, 0xff, 0xff];

const CORNER_RADIUS = 0.22;

// Lines of a script, shortening like a paragraph.
const LINE_RADIUS = 0.055;
const LINES = [
  { x0: 0.21, x1: 0.63, y: 0.25 },
  { x0: 0.21, x1: 0.54, y: 0.4 },
  { x0: 0.21, x1: 0.4, y: 0.55 },
];

// The pencil laid over them, derived from its axis (tip at PENCIL_TIP, butt at PENCIL_END)
// so the cone and the body meet exactly instead of being positioned by eye.
const PENCIL_TIP = [0.42, 0.81];
const PENCIL_END = [0.83, 0.4];
const PENCIL_HALF_WIDTH = 0.072;
const PENCIL_CONE = 0.155;

const PENCIL_LENGTH = Math.hypot(PENCIL_END[0] - PENCIL_TIP[0], PENCIL_END[1] - PENCIL_TIP[1]);
const AXIS = [
  (PENCIL_END[0] - PENCIL_TIP[0]) / PENCIL_LENGTH,
  (PENCIL_END[1] - PENCIL_TIP[1]) / PENCIL_LENGTH,
];
const ACROSS = [-AXIS[1], AXIS[0]];
const alongAxis = (from, distance) => [
  from[0] + AXIS[0] * distance,
  from[1] + AXIS[1] * distance,
];
const acrossAxis = (from, distance) => [
  from[0] + ACROSS[0] * distance,
  from[1] + ACROSS[1] * distance,
];
const CONE_BASE = alongAxis(PENCIL_TIP, PENCIL_CONE);

function sdRoundedBox(px, py, half, radius) {
  const qx = Math.abs(px) - (half - radius);
  const qy = Math.abs(py) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

function sdSegment(px, py, [ax, ay], [bx, by]) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function insideTriangle(px, py, [a, b, c]) {
  const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = sign([px, py], a, b);
  const d2 = sign([px, py], b, c);
  const d3 = sign([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function isGlyph(x, y) {
  for (const line of LINES) {
    if (sdSegment(x, y, [line.x0, line.y], [line.x1, line.y]) <= LINE_RADIUS) return true;
  }
  if (
    insideTriangle(x, y, [
      PENCIL_TIP,
      acrossAxis(CONE_BASE, PENCIL_HALF_WIDTH),
      acrossAxis(CONE_BASE, -PENCIL_HALF_WIDTH),
    ])
  ) {
    return true;
  }
  // Inset by the cap radius at both ends so the rounded caps land on the cone base and
  // on the butt, rather than sticking out past them.
  return (
    sdSegment(
      x,
      y,
      alongAxis(CONE_BASE, PENCIL_HALF_WIDTH),
      alongAxis(PENCIL_END, -PENCIL_HALF_WIDTH)
    ) <= PENCIL_HALF_WIDTH
  );
}

function backgroundColor(x, y) {
  // 135deg, the same direction as the CSS gradient.
  const t = Math.min(1, Math.max(0, (x + y) / 2));
  return [
    Math.round(GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t),
    Math.round(GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t),
    Math.round(GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t),
  ];
}

const SUPERSAMPLE = 4;

function renderRgba(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (sdRoundedBox(x - 0.5, y - 0.5, 0.5, CORNER_RADIUS) > 0) continue;
          const [cr, cg, cb] = isGlyph(x, y) ? GLYPH : backgroundColor(x, y);
          r += cr;
          g += cg;
          b += cb;
          a += 1;
        }
      }

      const offset = (py * size + px) * 4;
      if (a === 0) continue;
      // Averaged over covered samples only, so edge pixels keep the shape's color and
      // fade through alpha instead of darkening toward transparent black.
      pixels[offset] = Math.round(r / a);
      pixels[offset + 1] = Math.round(g / a);
      pixels[offset + 2] = Math.round(b / a);
      pixels[offset + 3] = Math.round((a / samples) * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach(({ size, png }, index) => {
    const at = index * 16;
    directory[at] = size >= 256 ? 0 : size; // 0 means 256
    directory[at + 1] = size >= 256 ? 0 : size;
    directory[at + 2] = 0; // palette size
    directory[at + 3] = 0;
    directory.writeUInt16LE(1, at + 4); // color planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((e) => e.png)]);
}

const rendered = new Map();
function pngFor(size) {
  if (!rendered.has(size)) rendered.set(size, encodePng(size, renderRgba(size)));
  return rendered.get(size);
}

function write(relativePath, buffer) {
  const target = path.join(OUT_DIR, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  console.log(`${relativePath}  ${buffer.length} bytes`);
}

const APP_SIZES = [16, 24, 32, 48, 64, 128, 256];
const FAVICON_SIZES = [16, 32, 48];

write(
  "electron/icon.ico",
  encodeIco(APP_SIZES.map((size) => ({ size, png: pngFor(size) })))
);
write(
  "src/app/favicon.ico",
  encodeIco(FAVICON_SIZES.map((size) => ({ size, png: pngFor(size) })))
);
