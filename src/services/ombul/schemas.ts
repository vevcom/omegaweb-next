import { maxOmbulFileSize } from './constants'
import { imageFileSchema, imageSchemas } from '@/services/images/subservice/schemas'
import { z } from 'zod'
import { File } from 'node:buffer'

const dataFieldSchemas = z.object({
    ombulFile: z.instanceof(File).refine(file => file.size < maxOmbulFileSize, 'Filen må være mindre enn 10 MB'),
    ombulCoverImage: imageFileSchema,
    year: z.coerce.number().int().refine(val =>
        (val === undefined) || (val >= 1919 && val <= (new Date()).getUTCFullYear()),
    'Må være mellom 1919 og nåværende år'
    ),
    issueNumber: z.coerce.number().optional().refine(val =>
        val === undefined || val <= 30, 'Maks 30'
    ),
    name: z.string().min(2, 'Minimum lengde er 2').max(25, 'Maks lengde er 25').trim(),
    description: z.string()
        .trim()
        .max(100, 'Maks lengde er 100')
        .refine(description => description.length !== 1, 'Minimum lengde er 2')
        .transform(description => description || null),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    ombulId: z.number(),
})

const ombulId = paramsFieldSchemas.pick({
    id: true,
})

const ombulImplementationId = paramsFieldSchemas.pick({
    ombulId: true,
})

export const ombulSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            ombulFile: true,
            ombulCoverImage: true,
            year: true,
            issueNumber: true,
            name: true,
            description: true
        }),
        update: dataFieldSchemas.pick({
            year: true,
            issueNumber: true,
            name: true,
            description: true
        }).partial(),
        updateFile: dataFieldSchemas.pick({
            ombulFile: true
        }),
        updateCoverImage: imageSchemas.data.uploadImage,
    },
    params: {
        read: ombulId,
        updateCoverImage: ombulImplementationId,
        destroy: ombulId,
        update: ombulId,
        updateFile: ombulId,
        updateParagraphContent: ombulImplementationId,
    },
}
