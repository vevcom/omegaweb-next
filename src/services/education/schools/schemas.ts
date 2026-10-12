import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { StandardSchool } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const baseSchool = z.object({
    name: z.string().max(50).min(1).trim(),
    shortName: z.string().max(20).min(1).trim(),
    standardSchool: z.nativeEnum(StandardSchool).optional(),
})

export const schoolSchemas = {
    create: baseSchool,
    update: baseSchool.pick({
        name: true,
        shortName: true,
    }).partial(),
    readMany: z.object({
        onlyNonStandard: z.boolean(),
    }),
    readPage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        z.undefined(),
    ),
}
