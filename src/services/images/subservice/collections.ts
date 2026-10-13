import type { expandedImageCollectionIncluder } from './constants'
import type { imageCollectionIdOrNameSchema } from './schemas'
import type { ExpandedImage, ExpandedImageCollection } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { z } from 'zod'

/** The unique where of a collection given by id or by name. */
export function uniqueCollectionWhere(params: z.infer<typeof imageCollectionIdOrNameSchema>) {
    return (
        'collectionId' in params ? { id: params.collectionId } : { name: params.collectionName }
    ) satisfies Prisma.ImageCollectionWhereUniqueInput
}

/**
 * Enriches a collection (read with {@link expandedImageCollectionIncluder}) into the
 * ExpandedImageCollection shape. The cover image is resolved as the
 * collection's explicit cover, else its first image, else the provided default (dynamic
 * collections pass the DEFAULT_IMAGE_COLLECTION_COVER standard image).
 */
export function expandImageCollection(
    collection: Prisma.ImageCollectionGetPayload<{ include: typeof expandedImageCollectionIncluder }>,
    defaultCoverImage: ExpandedImage | null,
): ExpandedImageCollection {
    const { images, _count, ...rest } = collection
    return {
        ...rest,
        coverImage: rest.coverImage ?? images[0] ?? defaultCoverImage,
        numberOfImages: _count.images,
    }
}
