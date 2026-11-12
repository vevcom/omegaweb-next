import { storeFilePath } from '@/services/store/paths'
import type { ImageResolution, ImageSize } from './resolutionForWidth'
import type { ExpandedImage } from '@/services/images/subservice/types'

/** Smallest to largest. Fallback walks this list when a tier is missing. */
const sizesSmallestFirst: ImageSize[] = ['MICRO', 'TINY', 'SMALL', 'MEDIUM', 'LARGE', 'HUGE']

const originalPath = (image: ExpandedImage) => storeFilePath('ORIGINAL_IMAGE', image.fsLocationOriginal)
const variantPath = (fsLocation: string) => storeFilePath('CACHE_IMAGE', fsLocation)

/**
 * Resolves what to actually put in an img src for a given resolution. The resized variants are
 * produced in the background after upload, so until processing finishes anything but ORIGINAL
 * falls back to the inline blur placeholder.
 *
 * Svgs have neither: a vector is the right file at every resolution, and it is available the moment
 * it is uploaded, so it is served as-is regardless of what was asked for.
 *
 * A tier the processing pipeline skipped has no stored file. See createRasterVariants. The
 * nearest smaller tier that does exist is served instead, falling back upward past micro since
 * tiny is the one guaranteed to exist once processedFiles does.
 */
export function imageSourceForResolution(image: ExpandedImage, resolution: ImageResolution): string {
    if (image.type === 'SVG') return originalPath(image)
    if (resolution === 'ORIGINAL') return originalPath(image)
    if (!image.processedFiles) return image.placeholderDataUrl ?? originalPath(image)

    const { processedFiles } = image
    const fsLocationBySize = {
        MICRO: processedFiles.fsLocationMicroSize,
        TINY: processedFiles.fsLocationTinySize,
        SMALL: processedFiles.fsLocationSmallSize,
        MEDIUM: processedFiles.fsLocationMediumSize,
        LARGE: processedFiles.fsLocationLargeSize,
        HUGE: processedFiles.fsLocationHugeSize,
    } satisfies Record<ImageSize, string | null>

    const resolutionIndex = sizesSmallestFirst.indexOf(resolution)
    for (let index = resolutionIndex; index >= 0; index--) {
        const fsLocation = fsLocationBySize[sizesSmallestFirst[index]]
        if (fsLocation) return variantPath(fsLocation)
    }
    for (let index = resolutionIndex + 1; index < sizesSmallestFirst.length; index++) {
        const fsLocation = fsLocationBySize[sizesSmallestFirst[index]]
        if (fsLocation) return variantPath(fsLocation)
    }
    // Unreachable. fsLocationTinySize is never null once processedFiles exists.
    return originalPath(image)
}

/**
 * Builds a srcset from each variant's real width so the browser can pick density itself.
 * Undefined for svgs, unprocessed images, and images with no recorded width.
 */
export function srcSetForImage(image: ExpandedImage): string | undefined {
    if (image.type === 'SVG' || !image.processedFiles) return undefined

    const { processedFiles } = image
    const variantsSmallestFirst: [string | null, number | null][] = [
        [processedFiles.fsLocationMicroSize, processedFiles.widthMicroSize],
        [processedFiles.fsLocationTinySize, processedFiles.widthTinySize],
        [processedFiles.fsLocationSmallSize, processedFiles.widthSmallSize],
        [processedFiles.fsLocationMediumSize, processedFiles.widthMediumSize],
        [processedFiles.fsLocationLargeSize, processedFiles.widthLargeSize],
        [processedFiles.fsLocationHugeSize, processedFiles.widthHugeSize],
    ]

    const srcSet = variantsSmallestFirst
        .filter((variant): variant is [string, number] => variant[0] !== null && variant[1] !== null)
        .map(([fsLocation, width]) => `${variantPath(fsLocation)} ${width}w`)
        .join(', ')

    return srcSet.length > 0 ? srcSet : undefined
}
