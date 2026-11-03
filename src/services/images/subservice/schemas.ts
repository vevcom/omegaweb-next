import {
    allowedExtensions,
    maxImageBatchSizeBytes,
    maxImageBatchSizeMb,
    maxImageCountInOneBatch,
    maxImageFileSizeBytes,
    maxImageFileSizeMb
} from './constants'
import { extensionForMimeType } from '@/lib/store/fileExtensions'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { zfd } from 'zod-form-data'
import { z } from 'zod'
import { File } from 'node:buffer'

/**
 * Checks the file against everything the image system can store, not against what the individual
 * implementation accepts - that subset is an operation field, enforced by the store when the file
 * is written. This is only here to keep obvious rubbish out before the operation runs.
 */
function fileHasAllowedExtension(file: File): boolean {
    return extensionForMimeType(file.type, allowedExtensions) !== null
}

export const imageFileSchema = z.instanceof(File).refine(
    file => file.size < maxImageFileSizeBytes, `Bildet må være mindre enn ${maxImageFileSizeMb} MB`
).refine(
    fileHasAllowedExtension,
    `Filtypen må være en av ${allowedExtensions.join(', ')}`
)

/**
 * Exported so the services that implement an image collection (dynamic collections, the special
 * collections) can validate collection fields the way the subservice does.
 */
export const imageDataFieldSchemas = z.object({
    collectionName: z.string().max(40).min(2).trim(),
    collectionDescription: z.string().max(500).min(2).trim(),
    coverImageId: z.number().optional(),

    imageFile: imageFileSchema,
    imageFiles: zfd.repeatable(z.array(z.instanceof(File)).refine(
        files => files.every(file => file.size < maxImageFileSizeBytes),
        `Alle filer må være mindre enn ${maxImageFileSizeMb} MB`
    )).refine(
        files => files.every(fileHasAllowedExtension),
        `Filtypen må være en av ${allowedExtensions.join(', ')}`
    ).refine(
        files => files.length <= maxImageCountInOneBatch && files.length > 0,
        `Du kan bare laste opp mellom 1 og ${maxImageCountInOneBatch} bilder av gangen`
    ).refine(
        files => files.reduce((total, file) => total + file.size, 0) <= maxImageBatchSizeBytes,
        `Bildene kan til sammen være maks ${maxImageBatchSizeMb} MB per opplasting`
    ),
    imageName: z.string().max(50, 'Maks lengde er 50 tegn').min(2, 'Minimum lengde er 2 tegn').optional(),
    imageAlt: z.string().max(100, 'Maks lengde er 100 tegn').min(2, 'Minimum lengde er 2 tegn'),
    // The license chooser sends 'NULL' for no license, and the id as a string otherwise.
    imageLicenseId: z.preprocess(
        value => (value === 'NULL' ? null : value),
        z.coerce.number().int().nullable().optional(),
    ),
    imageCredit: z.string().optional(),
})

const paramsFieldSchemas = z.object({
    collectionId: z.number(),
    collectionName: z.string(),
    imageId: z.number(),
    useFileName: z.boolean(),
})

/**
 * A collection is identified either by its id or by its name. Exported because the services
 * implementing the collection operations take the same identifier.
 */
export const imageCollectionIdOrNameSchema = z.union([
    paramsFieldSchemas.pick({
        collectionId: true,
    }),
    paramsFieldSchemas.pick({
        collectionName: true,
    }),
])

const imageId = paramsFieldSchemas.pick({
    imageId: true,
})

const imagePage = readPageInputSchemaObject(
    paramsFieldSchemas.pick({
        imageId: true,
    }),
    z.undefined(),
)

export const imageSchemas = {
    data: {
        updateCollection: imageDataFieldSchemas.partial().pick({
            collectionName: true,
            collectionDescription: true,
            coverImageId: true,
        }),
        uploadImage: imageDataFieldSchemas.pick({
            imageName: true,
            imageAlt: true,
            imageFile: true,
            imageLicenseId: true,
            imageCredit: true,
        }),
        uploadManyImages: imageDataFieldSchemas.pick({
            imageFiles: true,
            imageLicenseId: true,
            imageCredit: true,
        }),
        replaceImageFile: imageDataFieldSchemas.pick({
            imageFile: true,
        }),
        updateImageMeta: imageDataFieldSchemas.partial().pick({
            imageName: true,
            imageAlt: true,
            imageLicenseId: true,
            imageCredit: true,
        }),
    },
    params: {
        destroyCollection: imageCollectionIdOrNameSchema,
        updateCollection: imageCollectionIdOrNameSchema,
        uploadImage: imageCollectionIdOrNameSchema,
        replaceImageFile: imageId,
        processImageVariants: imageId,
        retryImageProcessing: imageId,
        uploadManyImages: paramsFieldSchemas.pick({
            collectionId: true,
            useFileName: true,
        }),
        readPageOfImagesInCollection: imagePage.merge(paramsFieldSchemas.pick({
            collectionId: true,
        })),
        // The special collection panel's readPageOfImagesInCollection: the panel knows its collection.
        readPageOfImagesInSpecialCollection: imagePage,
        updateImageMeta: imageId,
        destroyImageDbAndReturnCleanup: imageId,
        destroyImage: imageId,
        readCollectionOfImage: imageId,
    },
}
