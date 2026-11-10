import '@pn-server-only'
import { allowedExtensions, avifConvertionOptions, imageSizes, maxImageInputPixels } from './constants'
import { implementStore } from '@/services/store/implement'
import { ServiceError } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import sharp from 'sharp'

// libvips caches the results of operations, but every variant decodes the original anew, so the
// cache is never hit. It kept about 160mb per variant of a 26 megapixel photo, which ran the
// worker past its memory limit.
sharp.cache(false)

/** The files images are uploaded as. An image refers to its own as its original. */
export const originalImageStore = implementStore({
    purpose: 'ORIGINAL_IMAGE',
    allowedExtensions,
    preferredLocation: 'S3',
    owners: ['originalOfImage'],
})

/**
 * The resized variants of the raster images. They can be made again from the originals, so they
 * are kept on the store volume, out of the bucket and its limit on objects.
 *
 * An image that has lost a variant loses the record of them all, which is what makes the image
 * worker process it again. The variants it had are orphans from then on.
 */
export const cacheImageStore = implementStore({
    purpose: 'CACHE_IMAGE',
    allowedExtensions: ['avif'],
    preferredLocation: 'VOLUME',
    owners: ['microSizeOf', 'tinySizeOf', 'smallSizeOf', 'mediumSizeOf', 'largeSizeOf', 'hugeSizeOf'],
    repairLost: async names => {
        const processedFiles = await prisma.processedImageFiles.findMany({
            where: {
                OR: [
                    { fsLocationMicroSize: { in: names } },
                    { fsLocationTinySize: { in: names } },
                    { fsLocationSmallSize: { in: names } },
                    { fsLocationMediumSize: { in: names } },
                    { fsLocationLargeSize: { in: names } },
                    { fsLocationHugeSize: { in: names } },
                ],
            },
            select: { imageId: true },
        })
        const imageIds = processedFiles.map(files => files.imageId)
        await prisma.$transaction([
            prisma.processedImageFiles.deleteMany({ where: { imageId: { in: imageIds } } }),
            prisma.image.updateMany({
                where: { id: { in: imageIds } },
                data: { processingStartedAt: null, processingAttempts: 0, processingError: null },
            }),
        ])
    },
})

/**
 * Resizes the buffer down to the given width and encodes it as avif.
 * Only width is passed to sharp. Height scales automatically, so aspect ratio is preserved.
 * withoutEnlargement means a narrower source is returned unchanged instead of upscaled.
 * resolveWithObject also returns the real encoded width and height.
 */
export async function resizeToAvifBuffer(buffer: Buffer, width: number) {
    return await sharp(buffer, { limitInputPixels: maxImageInputPixels })
        .resize({ width, withoutEnlargement: true })
        .toFormat('avif')
        .avif(avifConvertionOptions)
        .toBuffer({ resolveWithObject: true })
}

async function createResizedAvifInStore(buffer: Buffer, width: number) {
    const { data, info } = await resizeToAvifBuffer(buffer, width)
    const { name } = await cacheImageStore.createFile(data)
    return { fsLocation: name, width: info.width, height: info.height }
}

/**
 * Produces one avif variant per size tier.
 * tiny is always produced. Every other tier, including micro, is skipped once its target
 * width matches an already produced tier, so no two tiers ever store the same image twice.
 */
type VariantFile = Awaited<ReturnType<typeof createResizedAvifInStore>>
type LargerTier = 'small' | 'medium' | 'large' | 'huge'

export async function createRasterVariants(buffer: Buffer) {
    const { width: sourceWidth = imageSizes.huge } = await sharp(buffer, { limitInputPixels: maxImageInputPixels })
        .metadata()

    // The variants written before a failure are left as orphans, which the store destroys.
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
 * The blur placeholder of a raster image, as an inline data url. Decoding the image to make it is also
 * the check that the file is an image sharp can read, within the pixel limit, so it is made before the
 * original is stored.
 */
export async function placeholderDataUrlOf(buffer: Buffer): Promise<string> {
    try {
        const { data } = await resizeToAvifBuffer(buffer, imageSizes.placeholder)
        return `data:image/avif;base64,${data.toString('base64')}`
    } catch {
        throw new ServiceError('BAD PARAMETERS', [{
            path: ['file'],
            message: `Bildet kunne ikke leses. Det kan være skadet, i et format som ikke støttes, eller større enn ${
                maxImageInputPixels / 1_000_000
            } megapiksler.`,
        }])
    }
}
