import type { imageSchemas } from '@/services/images/subservice/schemas'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { SubServiceOperation } from '@/services/serviceOperation'
import type { Image, ImageCollection, ProcessedImageFiles } from '@/prisma-generated-pn-types'

/**
 * The action type for uploading/updating an image.
 */
export type UploadSpecialCollectionImageAction = ActionFromSubServiceOperation<
    SubServiceOperation<unknown, false, undefined, typeof imageSchemas.data.uploadImage>
>

/**
 * An image together with its resized variants. The variants are produced in the background after
 * upload, so `processedFiles` is null until that finishes.
 *
 * `type` says which of the two kinds of image this is, and decides which of the raster-only fields
 * carry anything: an svg has no `placeholderDataUrl` and never gets `processedFiles`, because the
 * uploaded file already serves every resolution. Nothing outside `imageSourceForResolution` needs
 * to care - it resolves both kinds to a url.
 */
export type ExpandedImage = Image & {
    processedFiles: ProcessedImageFiles | null,
}

/**
 * An image collection enriched with a resolved cover image and its image count - the shape needed
 * to render a CollectionCard.
 */
export type ExpandedImageCollection = ImageCollection & {
    coverImage: ExpandedImage | null,
    numberOfImages: number,
}
