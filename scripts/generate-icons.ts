#!/usr/bin/env node
/**
 * Generates placeholder PNG icons:
 *   - images/extension-icon.png            (128x128, marketplace listing)
 *   - tasks/Nitro*V<N>/icon.png            (32x32, agent task tile)
 *
 * Each icon is a single solid color tinted by op (matching the GitHub Actions
 * branding: client=orange, fusion=purple, mcp=red, openapi=green,
 * schema=blue). These are intentionally minimal — production icons should be
 * generated from a single SVG sprite-sheet.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const COLORS: Record<string, [number, number, number]> = {
  client: [0xff, 0x8a, 0x40],
  fusion: [0x7c, 0x4d, 0xff],
  mcp: [0xe5, 0x39, 0x35],
  openapi: [0x43, 0xa0, 0x47],
  schema: [0x1e, 0x88, 0xe5],
};
const EXTENSION_COLOR: [number, number, number] = [0x21, 0x21, 0x21];

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size: number, [r, g, b]: [number, number, number]): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr[8] = 8;                    // bit depth
  ihdr[9] = 2;                    // color type RGB
  ihdr[10] = 0;                   // compression
  ihdr[11] = 0;                   // filter
  ihdr[12] = 0;                   // interlace

  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter byte = none
    for (let x = 0; x < size; x++) {
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function main(): void {
  ensureDir(path.join(root, "images"));
  fs.writeFileSync(path.join(root, "images", "extension-icon.png"), makePng(128, EXTENSION_COLOR));
  console.log("Wrote images/extension-icon.png");

  const tasksDir = path.join(root, "tasks");
  for (const name of fs.readdirSync(tasksDir)) {
    if (!/^Nitro[A-Z][A-Za-z]*V\d+$/.test(name)) continue;
    const lower = name.toLowerCase();
    const op = Object.keys(COLORS).find((k) => lower.includes(k));
    const color = op ? COLORS[op]! : EXTENSION_COLOR;
    fs.writeFileSync(path.join(tasksDir, name, "icon.png"), makePng(32, color));
    console.log(`Wrote tasks/${name}/icon.png`);
  }
}

main();
