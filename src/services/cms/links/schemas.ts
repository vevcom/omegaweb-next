import { isSafeLink, safeLinkMessage } from '@/lib/fields/safeLink'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().optional(),
    text: z.string().min(1, 'Linken må ha tekst på mer enn 1 bokstav').max(30, 'Max lengde er 30'),
    url: z.string().trim().refine(url => !url || isSafeLink(url), safeLinkMessage),
})

const paramsFieldSchemas = z.object({
    linkId: z.number(),
})

const linkId = paramsFieldSchemas.pick({
    linkId: true,
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
        destroy: linkId,
        update: linkId,
    },
}
