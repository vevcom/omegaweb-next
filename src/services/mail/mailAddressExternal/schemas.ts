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

export const mailAddressExternalSchemas = {
    create: z.object({
        address: validAddress,
        description: z.string().max(200).optional(),
    }),

    update: z.object({
        id: z.coerce.number().min(1),
        address: validAddress,
        description: z.string().max(200).optional(),
    }),

    destroy: z.object({
        id: z.coerce.number().min(1),
    }),
}
