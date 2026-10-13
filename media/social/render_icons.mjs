// Renders the website icon set from export/icon.svg (rounded tile) and src/icon-square.svg (full bleed).
// Run from repo root: node prototypes/media/social/render_icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../rovn-j01/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/package.json'));
const sharp = require('sharp');
const tile = await readFile(path.join(here, 'export/icon.svg'));
const square = await readFile(path.join(here, 'src/icon-square.svg'));
const png = (svg, size) => sharp(svg, { density: 1024 }).resize(size, size).png().toBuffer();
function ico(entries) {
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(({ size, buf }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size, o); head.writeUInt8(size, o + 1); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12); offset += buf.length;
  });
  return Buffer.concat([head, ...entries.map((e) => e.buf)]);
}
const out = path.join(here, 'export');
const [f16, f32, f48] = await Promise.all([16, 32, 48].map((s) => png(tile, s)));
await writeFile(path.join(out, 'favicon.ico'), ico([{ size: 16, buf: f16 }, { size: 32, buf: f32 }, { size: 48, buf: f48 }]));
await writeFile(path.join(out, 'icon-192.png'), await png(tile, 192));
await writeFile(path.join(out, 'icon-512.png'), await png(tile, 512));
await writeFile(path.join(out, 'icon-maskable-512.png'), await png(square, 512));
await writeFile(path.join(out, 'apple-touch-icon.png'), await png(square, 180));
await writeFile(path.join(out, 'logo-512.png'), await png(square, 512));
console.log('icons written');
