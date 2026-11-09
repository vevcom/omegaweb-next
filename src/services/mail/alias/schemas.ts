import { validMailAddressDomains } from '@/services/mail/constants'
import { mailOwnerRequirements, mailParamsFieldSchemas } from '@/services/mail/schemas'
import { Zpn } from '@/lib/fields/zpn'
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
    ownerRequirements: mailOwnerRequirements,
    hasMailbox: Zpn.checkboxOrBoolean({ label: 'Postkasse' }),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
    markOwnedByUserId: mailParamsFieldSchemas.shape.markOwnedByUserId,
})

/** The address comes as what stands before and after the @, with the domain picked from ours, and is stored joined. */
const joinAddress = <Rest extends object>({ localPart, domain, ...rest }: Rest & { localPart: string, domain: string }) =>
    ({ ...rest, address: `${localPart}@${domain}` })

const alias = paramsFieldSchemas.pick({
    id: true,
})

export const mailAliasSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            localPart: true,
            domain: true,
            description: true,
            ownerRequirements: true,
        }).transform(joinAddress),
        update: dataFieldSchemas.pick({
            localPart: true,
            domain: true,
            description: true,
        }).transform(joinAddress),
        updateDescription: dataFieldSchemas.pick({
            description: true,
        }),
        updateMailbox: dataFieldSchemas.pick({
            hasMailbox: true,
        }),
    },
    params: {
        readMany: paramsFieldSchemas.pick({ markOwnedByUserId: true }),
        update: alias,
        updateDescription: alias,
        updateMailbox: alias,
        visibility: alias,
        destroy: alias,
    },
}
