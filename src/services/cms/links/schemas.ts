import { SpecialCmsLink } from '@/prisma-generated-pn-types'
import { isSafeLink, safeLinkMessage } from '@/lib/fields/safeLink'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().optional(),
    text: z.string().min(1, 'Lenketeksten kan ikke være tom').max(30, 'Maks lengde er 30 tegn'),
    url: z.string().trim().refine(url => !url || isSafeLink(url), safeLinkMessage),
})

const paramsFieldSchemas = z.object({
    linkId: z.number(),
    special: z.nativeEnum(SpecialCmsLink),
})

const linkId = paramsFieldSchemas.pick({
    linkId: true,
})

const special = paramsFieldSchemas.pick({
    special: true,
})

export const cmsLinkSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            text: true,
            url: true,
        }),
        update: dataFieldSchemas.pick({
            text: true,
            url: true,
        }).partial(),
    },
    params: {
        generateSpecialCmsLinkFromConfig: special,
        destroy: linkId,
        update: linkId,
        readSpecial: special,
        // Takes every special the owning service holds, not one: a link is special if it is any of them.
        isSpecial: z.object({
            linkId: paramsFieldSchemas.shape.linkId,
            special: paramsFieldSchemas.shape.special.array(),
        }),
    },
}
