import { NTNUEmailDomain, validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'

const validAddress = z.string().email().min(2).max(50)
    .refine(
        address => !validMailAddressDomains.includes(address.split('@')[1].trim()),
        'E-post adressen inneholder et forbudt domene navn.',
    )
    .refine(
        address => !address.trim().endsWith(`@${NTNUEmailDomain}`),
        `E-post addressen kan ikke ha ${NTNUEmailDomain} domene. I slike tilfeller må personen være en bruker på nettsiden.`,
    )

const dataFieldSchemas = z.object({
    address: validAddress,
    description: z.string().max(200).optional(),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
})

const mailAddressExternal = paramsFieldSchemas.pick({
    id: true,
})

export const mailAddressExternalSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            address: true,
            description: true,
        }),
        update: dataFieldSchemas.pick({
            address: true,
            description: true,
        }),
    },
    params: {
        update: mailAddressExternal,
        destroy: mailAddressExternal,
    },
}
