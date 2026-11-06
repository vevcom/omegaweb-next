import { validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    localPart: z.string().trim().toLowerCase()
        .min(1, 'Skriv inn det som skal stå foran @')
        .max(64, 'Maks 64 tegn foran @')
        .regex(/^[a-z0-9]+([._+-][a-z0-9]+)*$/, 'Bare bokstaver, tall og . _ + - mellom dem'),
    domain: z.string().trim().toLowerCase().refine(
        domain => validMailAddressDomains().includes(domain),
        () => ({ message: `Domenet er ugyldig. Gyldige domener er: ${validMailAddressDomains().join(', ')}` }),
    ),
    description: z.string(),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
})

/** The address comes as what stands before and after the @, with the domain picked from ours, and is stored joined. */
const aliasData = dataFieldSchemas.pick({
    localPart: true,
    domain: true,
    description: true,
}).transform(({ localPart, domain, ...rest }) => ({ ...rest, address: `${localPart}@${domain}` }))

const alias = paramsFieldSchemas.pick({
    id: true,
})

export const mailAliasSchemas = {
    data: {
        create: aliasData,
        update: aliasData,
    },
    params: {
        update: alias,
        destroy: alias,
    },
}
