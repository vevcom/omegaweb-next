import { SpecialCmsLink } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const cmsLinkRefiner = {
    fcn: (url: string | undefined): boolean => {
        if (!url) return true
        try {
            const urlObject = new URL(url)
            return Boolean(urlObject)
        } catch {
            return url.startsWith('/') || url.includes('.')
        }
    },
    message: 'Ugyldig URL.'
}

const dataFieldSchemas = z.object({
    name: z.string().optional(),
    text: z.string().min(1, 'Linken må ha tekst på mer enn 1 bokstav').max(30, 'Max lengde er 30'),
    url: z.string().refine(cmsLinkRefiner.fcn, {
        message: cmsLinkRefiner.message
    }),
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
