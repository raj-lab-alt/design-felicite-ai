/**
 * Génère les icônes de l'application sans aucune dépendance native :
 * dessine un pictogramme « étoile à quatre branches » sur fond sombre arrondi,
 * l'encode en PNG (zlib intégré à Node) puis l'emballe dans un ICO (PNG-in-ICO,
 * compatible Windows Vista+) et enregistre un PNG haute résolution.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'build')
const SIZE = 256

/* ------------------------------- PNG brut ------------------------------- */

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0 // filtre : aucun
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

/* --------------------------- dessin du pictogramme --------------------------- */

const rgba = Buffer.alloc(SIZE * SIZE * 4)

function isInsideRoundedSquare(x, y, inset, radius) {
  const x0 = inset
  const y0 = inset
  const x1 = SIZE - inset
  const y1 = SIZE - inset
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false
  const cx = x < x0 + radius ? x0 + radius : x > x1 - radius ? x1 - radius : x
  const cy = y < y0 + radius ? y0 + radius : y > y1 - radius ? y1 - radius : y
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

/** Diamant creux (étoile à 4 branches stylisée : pleine au centre, aiguë aux pointes). */
function sparkleContribution(x, y, cx, cy, size, thickness) {
  const dx = x - cx
  const dy = y - cy
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  const inMainDiamond = adx / size + ady / size <= 1
  const tipLength = size * 2.1
  const inHorizontal = ady <= thickness && adx <= tipLength && dx >= -thickness
  const inVertical = adx <= thickness && ady <= tipLength && dy >= -thickness
  return inMainDiamond || inHorizontal || inVertical
}

function draw() {
  const inset = 12
  const radius = 64
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      if (!isInsideRoundedSquare(x, y, inset, radius)) {
        rgba[i + 3] = 0
        continue
      }
      const t = (x + y) / (2 * SIZE)
      const r0 = 0x12, g0 = 0x20, b0 = 0x3a // fond sombre haut
      const r1 = 0x1e, g1 = 0x2a, b1 = 0x4a // fond bas
      rgba[i] = Math.round(r0 + (r1 - r0) * t)
      rgba[i + 1] = Math.round(g0 + (g1 - g0) * t)
      rgba[i + 2] = Math.round(b0 + (b1 - b0) * t)
      rgba[i + 3] = 255
    }
  }

  const cx = SIZE / 2
  const cy = SIZE / 2
  const sparkle = (x, y, size, thickness, color) => {
    if (!sparkleContribution(x, y, cx, cy, size, thickness)) return
    const i = (y * SIZE + x) * 4
    rgba[i] = color[0]
    rgba[i + 1] = color[1]
    rgba[i + 2] = color[2]
    rgba[i + 3] = 255
  }

  const white = [0xff, 0xff, 0xff]
  const accentDeep = [0x3b, 0x82, 0xf6]
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      sparkle(x, y, 26, 6, white)
      sparkle(x + 0, y + 0, 10, 3, accentDeep)
    }
  }
  // Petite étincelle secondaire
  const s2 = { cx: cx + 64, cy: cy - 74 }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!sparkleContribution(x, y, s2.cx, s2.cy, 8, 2)) continue
      const i = (y * SIZE + x) * 4
      rgba[i] = white[0]
      rgba[i + 1] = white[1]
      rgba[i + 2] = white[2]
      rgba[i + 3] = 235
    }
  }
}

function wrapIco(png) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type : icône
  header.writeUInt16LE(1, 4) // nombre d'images
  const entry = Buffer.alloc(16)
  entry[0] = SIZE === 256 ? 0 : SIZE
  entry[1] = SIZE === 256 ? 0 : SIZE
  entry.writeUInt16LE(1, 4) // plans
  entry.writeUInt16LE(32, 6) // bits par pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12) // offset
  return Buffer.concat([header, entry, png])
}

draw()
const png = encodePng(rgba)
const ico = wrapIco(png)

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon.png'), png)
writeFileSync(join(outDir, 'icon.ico'), ico)
console.log(`Icônes générées dans ${outDir} (icon.png, icon.ico)`)