import { AppError } from '@shared/errors'
import { detectImageMeta } from './imageMeta'
import type { NativeImage } from 'electron'

export interface OptimizedImage {
  mimeType: string
  base64: string
  width: number
  height: number
}

export interface ImageOptimizer {
  /**
   * Préparé l'image pour l'envoi au modèle : redimensionnée si nécessaire
   * (PNG) avec conservation du rapport d'aspect, sinon telle quelle.
   */
  optimize(buffer: Buffer, maxSide: number): Promise<OptimizedImage>
}

/**
 * Optimiseur utilisant le décodage/redimensionnement natif d'Electron (Chromium).
 * Importé paresseusement pour rester testable hors Electron ; en cas d'indisponibilité,
 * l'app retombe sur PassthroughImageOptimizer.
 */
export class NativeImageOptimizer implements ImageOptimizer {
  async optimize(buffer: Buffer, maxSide: number): Promise<OptimizedImage> {
    let nativeImage: typeof import('electron').nativeImage
    try {
      const electron = await import('electron')
      nativeImage = electron.nativeImage
    } catch {
      throw new AppError('ERR_IMAGE_DECODE', 'Composant de décodage natif indisponible.')
    }

    let image: NativeImage
    try {
      image = nativeImage.createFromBuffer(buffer)
    } catch {
      throw new AppError('ERR_IMAGE_DECODE')
    }
    if (image.isEmpty()) throw new AppError('ERR_IMAGE_DECODE')

    const size = image.getSize()
    if (size.width === 0 || size.height === 0) throw new AppError('ERR_IMAGE_DECODE')

    const scale = Math.min(1, maxSide / Math.max(size.width, size.height))
    if (scale >= 1) {
      // Pas de redimensionnement : renvoie l'original tel quel.
      const meta = detectImageMeta(buffer)
      if (!meta) throw new AppError('ERR_IMAGE_DECODE')
      return { mimeType: meta.mimeType, base64: buffer.toString('base64'), width: size.width, height: size.height }
    }

    const resized = image.resize({
      width: Math.round(size.width * scale),
      height: Math.round(size.height * scale),
      quality: 'good'
    })
    const png = resized.toPNG()
    return {
      mimeType: 'image/png',
      base64: png.toString('base64'),
      width: resized.getSize().width,
      height: resized.getSize().height
    }
  }
}

/** Retourne l'image brute (aucun redimensionnement). Utilisé en repli ou dans les tests. */
export class PassthroughImageOptimizer implements ImageOptimizer {
  async optimize(buffer: Buffer): Promise<OptimizedImage> {
    const meta = detectImageMeta(buffer)
    if (!meta) throw new AppError('ERR_IMAGE_DECODE')
    return { mimeType: meta.mimeType, base64: buffer.toString('base64'), width: meta.width, height: meta.height }
  }
}