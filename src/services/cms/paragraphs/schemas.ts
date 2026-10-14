import { SpecialCmsParagraph } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().optional(),
    markdown: z.string()
})

const paramsFieldSchemas = z.object({
    paragraphId: z.number(),
    special: z.nativeEnum(SpecialCmsParagraph),
})

const paragraphId = paramsFieldSchemas.pick({
    paragraphId: true,
})

const special = paramsFieldSchemas.pick({
    special: true,
})

export const cmsParagraphSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
        }).partial(),
        updateContent: dataFieldSchemas.pick({
            markdown: true,
        }),
    },
    params: {
        generateSpecialCmsParagraphFromConfig: special,
        destroy: paragraphId,
        readSpecial: special,
        update: paragraphId,
        updateContent: paragraphId,
        // Takes every special the owning service holds, not one: a paragraph is special if it is any of them.
        isSpecial: z.object({
            paragraphId: paramsFieldSchemas.shape.paragraphId,
            special: paramsFieldSchemas.shape.special.array(),
        }),
    },
}
