import {
    allowedExtensions,
    maxImageCountInOneBatch,
    maxImageFileSizeBytes,
    maxImageFileSizeMb
} from './constants'
import { extensionForMimeType } from '@/lib/store/fileExtensions'
import { readPageInputSchema } from '@/lib/paging/schema'
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
    file => file.size < maxImageFileSizeBytes, `File size must be less than ${maxImageFileSizeMb}mb`
).refine(
    fileHasAllowedExtension,
    `File type must be one of ${allowedExtensions.join(', ')}`
)

export const baseSchema = z.object({
    collectionName: z.string().max(40).min(2).trim(),
    collectionDescription: z.string().max(500).min(2).trim(),
    coverImageId: z.number().optional(),

    imageFile: imageFileSchema,
    imageFiles: zfd.repeatable(z.array(z.instanceof(File)).refine(
        files => files.every(file => file.size < maxImageFileSizeBytes),
        `Alle filer må være mindre enn ${maxImageFileSizeMb}mb`
    )).refine(
        files => files.every(fileHasAllowedExtension),
        `Filtypen må være en av ${allowedExtensions.join(', ')}`
    ).refine(
        files => files.length <= maxImageCountInOneBatch && files.length > 0,
        `Du kan bare laste opp mellom 1 og ${maxImageCountInOneBatch} bilder av gangen`
    ),
    imageName: z.string().max(50, 'max length in 50').min(2, 'min length is 2').optional(),
    imageAlt: z.string().max(100, 'max length in 50').min(2, 'min length is 2'),
    imageLicenseId: z.union([
        z.string().optional().nullable(),
        z.coerce.number().optional().or(z.literal('NULL')),
    ]).transform(
        value => {
            if (typeof value === 'string' && value === 'NULL') return null
            if (typeof value === 'string') return parseInt(value, 10)
            return value
        }
    ),
    imageCredit: z.string().optional(),
})

const pageSchema = readPageInputSchema(
    z.object({
        imageId: z.number(),
    }),
    z.undefined(),
)

export const imageSchemas = {
    paramsSchemaCollection: z.union([
        z.object({ collectionId: z.number() }),
        z.object({ collectionName: z.string() })
    ]),
    paramsSchemaImage: z.object({
        imageId: z.number(),
    }),
    paramsSchemaUploadManyImages: z.object({
        collectionId: z.number(),
        useFileName: z.boolean(),
    }),
    paramsSchemaReadPageOfImagesInCollection: z.object({
        paging: pageSchema,
        collectionId: z.number(),
    }),
    paramsSchemaReadPageOfImagesInSpecialCollection: z.object({
        paging: pageSchema,
    }),
    updateCollection: baseSchema.partial().pick({
        collectionName: true,
        collectionDescription: true,
        coverImageId: true,
    }),
    uploadImage: baseSchema.pick({
        imageName: true,
        imageAlt: true,
        imageFile: true,
        imageLicenseId: true,
        imageCredit: true,
    }),
    uploadManyImages: baseSchema.pick({
        imageFiles: true,
        imageLicenseId: true,
        imageCredit: true,
    }),
    replaceImageFile: baseSchema.pick({
        imageFile: true,
    }),
    updateImageMeta: baseSchema.partial().pick({
        imageName: true,
        imageAlt: true,
        imageLicenseId: true,
        imageCredit: true,
    }),
} as const
