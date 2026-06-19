// 픽셀 토마토를 1024px PNG 로 그려 src-tauri/app-icon.png 로 저장한다.
// 이후 `tauri icon` 이 이 파일에서 모든 플랫폼 아이콘(.icns/.ico/.png)을 생성한다.
// 외부 의존성 없이 Node 내장 zlib 만으로 PNG 를 인코딩한다.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { cells: tomatoCells } = require("../src/tomato.core.js");

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, y * w * 4 + w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function parseColor(s) {
  if (s[0] === "#") {
    const h = s.slice(1);
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      255,
    ];
  }
  const m = s.match(/\d+/g).map(Number);
  return [m[0], m[1], m[2], 255];
}
function render(size) {
  const r = tomatoCells(1, { face: "happy", cheeks: true });
  const W = r.W;
  const pad = Math.round(size * 0.08);
  const u = (size - pad * 2) / W;
  const rgba = Buffer.alloc(size * size * 4); // 투명
  function px(x, y, c) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = c[0];
    rgba[i + 1] = c[1];
    rgba[i + 2] = c[2];
    rgba[i + 3] = c[3];
  }
  r.cells.forEach((cell) => {
    const col = parseColor(cell.color);
    const x0 = Math.round(pad + cell.x * u),
      y0 = Math.round(pad + cell.y * u),
      x1 = Math.round(pad + (cell.x + 1) * u),
      y1 = Math.round(pad + (cell.y + 1) * u);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, col);
  });
  return encodePNG(size, size, rgba);
}

const out = path.join(__dirname, "..", "src-tauri", "app-icon.png");
fs.writeFileSync(out, render(1024));
console.log("wrote", out);
