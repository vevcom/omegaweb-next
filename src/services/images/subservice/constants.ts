import type { StorableExtension } from '@/lib/store/fileExtensions'
import type { Prisma } from '@/prisma-generated-pn-types'

type StorableExtensions = readonly StorableExtension[]

/**
 * Room for full-size exports from a professional camera: a max-quality jpeg from a 45 to 61 megapixel
 * camera is about 15 to 40mb. The memory an image takes to process is bounded by maxImageInputPixels.
 */
export const maxImageFileSizeMb = 50

export const maxImageFileSizeBytes = maxImageFileSizeMb * 1024 * 1024

export const maxImageCountInOneBatch = 10

/**
 * The most one upload request may carry in total. The client splits a batch so it stays under this,
 * and a single image of the largest size always fits. Must stay below the server action body size
 * limit in next.config.ts.
 */
export const maxImageBatchSizeMb = 60

export const maxImageBatchSizeBytes = maxImageBatchSizeMb * 1024 * 1024

/**
 * The most pixels an image may have for sharp to decode it: enough for a 61 megapixel camera, and a
 * quarter of sharp's default, which lets a small file that decodes to a huge image take the memory of
 * the server.
 */
export const maxImageInputPixels = 64_000_000

export const imageSizes = {
    placeholder: 16,
    micro: 160,
    tiny: 320,
    small: 640,
    medium: 960,
    large: 1280,
    huge: 1920,
} as const

export const imageProcessing = {
    maxAttempts: 3,
    /**
     * How long a worker can take to process an image before its claim is considered stale and
     * another worker can pick it up. This is a safety valve for when a worker dies mid-processing,
     * and - since a failed attempt keeps its claim - it is also the delay between attempts.
     */
    staleClaimMinutes: 2,
} as const

export const avifConvertionOptions = {
    quality: 50,
    lossless: false,
    speed: 8, // default is 5
    chromaSubsampling: '4:2:0',
} as const

/**
 * Formats that go through the background resize pipeline. `jpg` is absent on purpose - the store
 * names every jpeg `jpeg`, so `jpg` can never come back out of it.
 */
export const rasterExtensions = ['png', 'jpeg', 'heic', 'avif', 'webp'] as const satisfies StorableExtensions

export const svgExtensions = ['svg'] as const satisfies StorableExtensions

/**
 * Everything the image system can store. Individual implementations of th image system
 * accept a subset of this.
 */
export const allowedExtensions = [...rasterExtensions, ...svgExtensions] as const

export type ImageExtension = typeof allowedExtensions[number]

export const expandedImageIncluder = {
    processedFiles: true,
} satisfies Prisma.ImageInclude

export const expandedImageCollectionIncluder = {
    coverImage: { include: expandedImageIncluder },
    images: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        include: expandedImageIncluder,
    },
    _count: { select: { images: true } },
} satisfies Prisma.ImageCollectionInclude
