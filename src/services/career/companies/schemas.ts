import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { CompanySponsorTier } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(
        2, 'Navnet må være minst 2 tegn langt'
    ).max(
        100, 'Navnet kan maks være 100 tegn langt'
    ),
    description: z.string().trim().max(
        200, 'Beskrivelsen kan maks være 200 tegn langt'
    ),
    website: z.union([
        z.literal('').transform(() => null),
        z.string().trim()
            .url('Nettsiden må være en full URL, f.eks. https://omega.ntnu.no')
            .refine(
                website => ['http:', 'https:'].includes(new URL(website).protocol),
                'Nettsiden må starte med http:// eller https://'
            ),
    ]).nullable(),
    sponsorTier: z.nativeEnum(CompanySponsorTier, {
        errorMap: () => ({ message: 'Velg en gyldig samarbeidsgrad' }),
    }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    companyId: z.number(),
    name: z.string().max(100).optional(),
})

const id = paramsFieldSchemas.pick({
    id: true,
})

export const companySchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
        }),
        update: dataFieldSchemas.partial().pick({
            name: true,
            description: true,
            website: true,
        }),
        updateSponsorTier: dataFieldSchemas.pick({
            sponsorTier: true,
        }),
    },
    params: {
        readPage: readPageInputSchemaObject(
            id,
            paramsFieldSchemas.pick({
                name: true,
            }),
        ),
        update: id,
        updateSponsorTier: id,
        updateCmsImageLogo: paramsFieldSchemas.pick({
            companyId: true,
        }),
        destroy: id,
    },
}
