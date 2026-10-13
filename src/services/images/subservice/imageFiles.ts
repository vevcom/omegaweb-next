import '@pn-server-only'
import { allowedExtensions, avifConvertionOptions, imageSizes } from './constants'
import { implementStore } from '@/lib/store/implementStore'
import logger from '@/lib/logger'
import sharp from 'sharp'
import { File } from 'node:buffer'
import type { ExpandedImage } from './types'

/** Where the image system keeps its files: the originals and the resized variants. */
export const imageStore = implementStore({
    staticStorePrefix: 'images',
    allowedExtentions: allowedExtensions,
})

/**
 * Resizes the buffer down to the given width and encodes it as avif.
 * Only width is passed to sharp. Height scales automatically, so aspect ratio is preserved.
 * withoutEnlargement means a narrower source is returned unchanged instead of upscaled.
 * resolveWithObject also returns the real encoded width and height.
 */
export async function resizeToAvifBuffer(buffer: Buffer, width: number) {
    return await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .toFormat('avif')
        .avif(avifConvertionOptions)
        .toBuffer({ resolveWithObject: true })
}

async function createResizedAvifInStore(buffer: Buffer, width: number) {
    const { data, info } = await resizeToAvifBuffer(buffer, width)
    const avifFile = new File([new Uint8Array(data)], 'image.avif', { type: 'image/avif' })
    const storedFile = await imageStore.createFile(avifFile, ['avif'])
    return { ...storedFile, width: info.width, height: info.height }
}

/**
 * Produces one avif variant per size tier.
 * tiny is always produced. Every other tier, including micro, is skipped once its target
 * width matches an already produced tier, so no two tiers ever store the same image twice.
 */
type VariantFile = Awaited<ReturnType<typeof createResizedAvifInStore>>
type LargerTier = 'small' | 'medium' | 'large' | 'huge'

export async function createRasterVariants(buffer: Buffer) {
    const { width: sourceWidth = imageSizes.huge } = await sharp(buffer).metadata()

    const tinyWidth = Math.min(imageSizes.tiny, sourceWidth)
    const tiny = await createResizedAvifInStore(buffer, tinyWidth)

    const microWidth = Math.min(imageSizes.micro, sourceWidth)
    const micro = microWidth === tinyWidth ? undefined : await createResizedAvifInStore(buffer, microWidth)

    let lastWidth = tinyWidth
    const rest: Partial<Record<LargerTier, VariantFile>> = {}
    for (const tier of ['small', 'medium', 'large', 'huge'] as const) {
        const targetWidth = Math.min(imageSizes[tier], sourceWidth)
        if (targetWidth === lastWidth) continue
        rest[tier] = await createResizedAvifInStore(buffer, targetWidth)
        lastWidth = targetWidth
    }

    return { micro, tiny, ...rest }
}

/**
 * Every file in the store belonging to an image: the original, plus the resized variants if the
 * background worker has produced them yet (svgs never have any).
 */
export function storedFileLocationsOfImage(image: Pick<ExpandedImage, 'fsLocationOriginal' | 'processedFiles'>): string[] {
    if (!image.processedFiles) return [image.fsLocationOriginal]
    return [
        image.fsLocationOriginal,
        image.processedFiles.fsLocationMicroSize,
        image.processedFiles.fsLocationTinySize,
        image.processedFiles.fsLocationSmallSize,
        image.processedFiles.fsLocationMediumSize,
        image.processedFiles.fsLocationLargeSize,
        image.processedFiles.fsLocationHugeSize,
    ].filter((fsLocation): fsLocation is string => fsLocation !== null)
}

/**
 * Best-effort removal of files whose database rows are already gone. A missing file is not an
 * error (it is the state we want), and one failure must not stop the rest from being attempted -
 * so failures are logged rather than thrown.
 */
export async function destroyStoredFiles(fsLocations: string[], context: string): Promise<void> {
    const results = await Promise.allSettled(
        fsLocations.map(fsLocation => imageStore.destroyFile(fsLocation, undefined, false))
    )
    const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (errors.length > 0) {
        logger.error(`Failed to clean up ${errors.length} image file(s) after ${context}`, {
            errors: errors.map(error => error.reason)
        })
    }
}
