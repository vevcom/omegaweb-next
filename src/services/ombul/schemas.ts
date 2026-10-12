import { imageFileSchema, imageSchemas } from '@/services/images/subservice/schemas'
import { maxOmbulFileSize } from '@/services/ombul/constants'
import { z } from 'zod'
import { File } from 'node:buffer'

export const baseSchema = z.object({
    ombulFile: z.instanceof(File).refine(file => file.size < maxOmbulFileSize, 'Fil må være mindre enn 10mb'),
    ombulCoverImage: imageFileSchema,
    year: z.coerce.number().int().refine(val =>
        (val === undefined) || (val >= 1919 && val <= (new Date()).getFullYear()),
    'Må være mellom 1919 og nåværende år'
    ),
    issueNumber: z.coerce.number().optional().refine(val =>
        val === undefined || val <= 30, 'max 30'
    ),
    name: z.string().min(2, 'Minimum lengde er 2').max(25, 'Maximum lengde er 25').trim(),
    description: z.string()
        .trim()
        .max(100, 'Maximum lengde er 100')
        .refine(description => description.length !== 1, 'Minimum lengde er 2')
        .transform(description => description || null),
})

export const ombulSchemas = {
    create: baseSchema.pick({
        ombulFile: true,
        ombulCoverImage: true,
        year: true,
        issueNumber: true,
        name: true,
        description: true
    }),
    update: baseSchema.pick({
        year: true,
        issueNumber: true,
        name: true,
        description: true
    }).partial(),
    updateFile: baseSchema.pick({
        ombulFile: true
    }),
    updateCoverImage: imageSchemas.uploadImage,
} as const
