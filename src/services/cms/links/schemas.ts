import { SpecialCmsLink } from '@/prisma-generated-pn-types'
import { z } from 'zod'

/** A full URL, an internal path, or something with a dot in it that a browser will take for a host. */
const isUrlOrPath = (url: string): boolean => {
    if (!url) return true
    try {
        return Boolean(new URL(url))
    } catch {
        return url.startsWith('/') || url.includes('.')
    }
}

const dataFieldSchemas = z.object({
    name: z.string().optional(),
    text: z.string().min(1, 'Linken må ha tekst på mer enn 1 bokstav').max(30, 'Max lengde er 30'),
    url: z.string().refine(isUrlOrPath, 'Ugyldig URL.'),
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
