import { validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'

const validAddress = z.string().email().refine(
    address => validMailAddressDomains.includes(address.split('@')[1].trim()),
    `The domain is not valid, valid domains are: ${validMailAddressDomains.join(', ')}`
)

export const mailAliasSchemas = {
    create: z.object({
        address: validAddress,
        description: z.string(),
    }),

    update: z.object({
        id: z.coerce.number().min(1),
        address: validAddress,
        description: z.string(),
    }),

    destroy: z.object({
        id: z.coerce.number().min(1),
    }),
}
