import { fieldSchemas as articleSectionFieldSchemas } from '@/cms/articleSections/schemas'
import { z } from 'zod'

const baseSchema = z.object({
    name: z.string().min(2, 'Minimum lengde er 2 tegn.').max(30, 'Maksimum lengde er 30 tegn.'),
    includeParts: z.record(articleSectionFieldSchemas.shape.part, z.boolean()),
    direction: z.union([z.literal('UP'), z.literal('DOWN')])
})

export const articleSchemas = {
    create: ({ maxNameLength }: { maxNameLength: number }) => z.object({
        name: z.string()
            .min(2, 'Minimum lengde er 2 tegn.')
            .max(maxNameLength, `Maksimum lengde er ${maxNameLength} tegn.`)
            .optional(),
    }),
    update: baseSchema.pick({
        name: true,
    }).partial(),
    addSection: baseSchema.pick({
        includeParts: true
    }),
    reorderSections: baseSchema.pick({
        direction: true
    }),
    params: z.object({
        articleId: z.number()
    })
} as const
