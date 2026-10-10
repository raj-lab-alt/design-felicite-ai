import { describe, expect, it } from 'vitest'
import { detectImageMeta, extensionForMime, mimeForExtension } from '@main/utils/imageMeta'

describe('detectImageMeta', () => {
  it('détecte un PNG (largeur/hauteur depuis IHDR)', () => {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const ihdr = Buffer.alloc(16)
    ihdr.writeUInt32BE(13, 0)
    ihdr.write('IHDR', 4, 'ascii')
    ihdr.writeUInt32BE(800, 8)
    ihdr.writeUInt32BE(600, 12)
    const meta = detectImageMeta(Buffer.concat([signature, ihdr]))
    expect(meta).toEqual({ mimeType: 'image/png', width: 800, height: 600, format: 'png' })
  })

  it('détecte un JPEG (marqueur SOF0)', () => {
    const buffer = Buffer.alloc(16)
    buffer[0] = 0xff
    buffer[1] = 0xd8
    buffer[2] = 0xff
    buffer[3] = 0xc0
    buffer.writeUInt16BE(0x0011, 4)
    buffer.writeUInt16BE(480, 7)
    buffer.writeUInt16BE(640, 9)
    const meta = detectImageMeta(buffer)
    expect(meta).toEqual({ mimeType: 'image/jpeg', width: 640, height: 480, format: 'jpeg' })
  })

  it('détecte un WebP avec perte (VP8 )', () => {
    const buffer = Buffer.alloc(30)
    buffer.write('RIFF', 0, 'ascii')
    buffer.writeUInt32LE(26, 4)
    buffer.write('WEBP', 8, 'ascii')
    buffer.write('VP8 ', 12, 'ascii')
    buffer[24] = 0x9d
    buffer[25] = 0x01
    buffer[26] = 0x2a
    buffer.writeUInt16LE(640, 26)
    buffer.writeUInt16LE(480, 28)
    const meta = detectImageMeta(buffer)
    expect(meta?.mimeType).toBe('image/webp')
    expect(meta?.width).toBe(640)
    expect(meta?.height).toBe(480)
  })

  it('retourne null pour un buffer inconnu ou trop court', () => {
    expect(detectImageMeta(Buffer.from('hello'))).toBeNull()
    expect(detectImageMeta(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]))).toBeNull()
  })
})

describe('extensionForMime / mimeForExtension', () => {
  it('converts entre mime et extension', () => {
    expect(extensionForMime('image/png')).toBe('.png')
    expect(extensionForMime('image/jpeg')).toBe('.jpg')
    expect(extensionForMime('image/webp')).toBe('.webp')
    expect(extensionForMime('application/octet-stream')).toBe('.bin')
    expect(mimeForExtension('.jpg')).toBe('image/jpeg')
    expect(mimeForExtension('.WEBP')).toBe('image/webp')
    expect(mimeForExtension('.gif')).toBeNull()
  })
})