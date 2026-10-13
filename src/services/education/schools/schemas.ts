import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { StandardSchool } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().max(50).min(1).trim(),
    shortName: z.string().max(20).min(1).trim(),
    standardSchool: z.nativeEnum(StandardSchool).optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    shortName: z.string(),
    standardSchool: z.nativeEnum(StandardSchool),
    onlyNonStandard: z.boolean(),
})

const id = paramsFieldSchemas.pick({
    id: true,
})

const shortName = paramsFieldSchemas.pick({
    shortName: true,
})

export const schoolSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            shortName: true,
            standardSchool: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            shortName: true,
        }).partial(),
    },
    params: {
        read: shortName,
        createStandard: paramsFieldSchemas.pick({
            standardSchool: true,
        }),
        updateCmsParagraphContent: shortName,
        updateCmsImage: shortName,
        updateCmsLink: shortName,
        destroy: id,
        readExpandedPage: readPageInputSchemaObject(
            id,
            z.undefined(),
        ),
        readMany: paramsFieldSchemas.pick({
            onlyNonStandard: true,
        }),
        update: id,
    },
}
