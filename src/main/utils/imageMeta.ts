/**
 * Détection des métadonnées d'image sans dépendance native ni Electron.
 * Prend en charge PNG, JPEG et WebP (lecture des en-têtes).
 */

export interface ImageMeta {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
  format: 'png' | 'jpeg' | 'webp'
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function detectImageMeta(buffer: Buffer): ImageMeta | null {
  if (buffer.length < 16) return null
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return parsePng(buffer)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return parseJpeg(buffer)
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return parseWebp(buffer)
  }
  return null
}

function parsePng(buffer: Buffer): ImageMeta | null {
  // IHDR : largeur offset 16, hauteur offset 20 (big-endian).
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (!width || !height) return null
  return { mimeType: 'image/png', width, height, format: 'png' }
}

function parseJpeg(buffer: Buffer): ImageMeta | null {
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buffer[offset + 1]
    // Marqueurs SOF (hors DHT/DAC/RSTn)
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = buffer.readUInt16BE(offset + 5)
      const width = buffer.readUInt16BE(offset + 7)
      if (!width || !height) return null
      return { mimeType: 'image/jpeg', width, height, format: 'jpeg' }
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }
    if (offset + 3 >= buffer.length) break
    const segmentLength = buffer.readUInt16BE(offset + 2)
    if (segmentLength < 2) break
    offset += 2 + segmentLength
  }
  return null
}

function parseWebp(buffer: Buffer): ImageMeta | null {
  const chunk = buffer.subarray(12, 16).toString('ascii')
  if (chunk === 'VP8 ') {
    // Format avec perte : dimensions après le start code 0x9d 0x01 0x2a.
    if (buffer.length < 30) return null
    const width = buffer.readUInt16LE(26) & 0x3fff
    const height = buffer.readUInt16LE(28) & 0x3fff
    if (!width || !height) return null
    return { mimeType: 'image/webp', width, height, format: 'webp' }
  }
  if (chunk === 'VP8L') {
    if (buffer.length < 25) return null
    const b1 = buffer[21]
    const b2 = buffer[22]
    const b3 = buffer[23]
    const b4 = buffer[24]
    const width = 1 + (((b1 | (b2 << 8)) & 0x3fff))
    const height = 1 + (((b2 >> 6) | (b3 << 2) | (b4 << 10)) & 0x3fff)
    if (!width || !height) return null
    return { mimeType: 'image/webp', width, height, format: 'webp' }
  }
  if (chunk === 'VP8X') {
    if (buffer.length < 30) return null
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16))
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16))
    if (!width || !height) return null
    return { mimeType: 'image/webp', width, height, format: 'webp' }
  }
  return null
}

export function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return '.png'
    case 'image/jpeg':
      return '.jpg'
    case 'image/webp':
      return '.webp'
    default:
      return '.bin'
  }
}

export function mimeForExtension(ext: string): string | null {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      return null
  }
}
