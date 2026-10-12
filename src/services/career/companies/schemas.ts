import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { CompanySponsorTier } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const fieldSchemas = z.object({
    id: z.number(),
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

export const companySchemas = {
    create: fieldSchemas.pick({
        name: true,
        description: true,
    }),
    update: fieldSchemas.partial().pick({
        name: true,
        description: true,
        website: true,
    }),
    updateSponsorTier: fieldSchemas.pick({
        sponsorTier: true,
    }),
} as const

const companyId = fieldSchemas.pick({
    id: true,
})

export const companyParamsSchemas = {
    readPage: readPageInputSchemaObject(
        fieldSchemas.pick({
            id: true,
        }),
        z.object({
            name: z.string().max(100).optional(),
        }),
    ),
    update: companyId,
    updateSponsorTier: companyId,
    updateCmsImageLogo: z.object({
        companyId: fieldSchemas.shape.id,
    }),
    destroy: companyId,
} as const
