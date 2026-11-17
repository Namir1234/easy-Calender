// Zeichnet die App-Symbole für den Home-Bildschirm (PNG, ohne Zusatzpakete).
// Aufruf: node web/make-icons.mjs
/* eslint-disable @typescript-eslint/explicit-function-return-type -- reines JavaScript */
import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

const INK = [22, 24, 29]
const PAPER = [255, 255, 255]
const ACCENT = [200, 50, 30]
const MUTED = [163, 168, 179]

/** Liegt (x, y) im Rechteck mit runden Ecken? Koordinaten 0..1 */
function inRoundRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false
  const cx = Math.min(Math.max(x, left + radius), right - radius)
  const cy = Math.min(Math.max(y, top + radius), bottom - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

/** Farbe eines Punkts: Fläche, Blatt, roter Kopf, Ringe, Tagesraster */
function colorAt(x, y) {
  // Ringe oben
  for (const rx of [0.37, 0.63]) {
    if (inRoundRect(x, y, rx - 0.025, 0.2, rx + 0.025, 0.33, 0.025)) return MUTED
  }
  if (inRoundRect(x, y, 0.22, 0.25, 0.78, 0.78, 0.06)) {
    if (y < 0.4) return ACCENT
    // Raster 3 × 2 Tage, einer davon hervorgehoben
    const cols = [0.3, 0.46, 0.62]
    const rows = [0.47, 0.61]
    for (const [ri, ry] of rows.entries()) {
      for (const [ci, cx] of cols.entries()) {
        if (inRoundRect(x, y, cx, ry, cx + 0.08, ry + 0.08, 0.015)) {
          return ri === 1 && ci === 1 ? ACCENT : MUTED
        }
      }
    }
    return PAPER
  }
  return INK
}

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size) {
  const samples = 4
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const c = colorAt((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size)
          for (let i = 0; i < 3; i++) sum[i] += c[i]
        }
      }
      const offset = py * (size * 3 + 1) + 1 + px * 3
      for (let i = 0; i < 3; i++) raw[offset + i] = Math.round(sum[i] / samples ** 2)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // Bit pro Kanal
  header[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const dir = new URL('./public/', import.meta.url)
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180]
]) {
  writeFileSync(new URL(name, dir), png(size))
  console.log(name)
}
