import { validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'

const validAddress = z.string().email().refine(
    address => validMailAddressDomains.includes(address.split('@')[1].trim()),
    `The domain is not valid, valid domains are: ${validMailAddressDomains.join(', ')}`
)

const dataFieldSchemas = z.object({
    id: z.coerce.number().min(1),
    address: validAddress,
    description: z.string(),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
})

export const mailAliasSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            address: true,
            description: true,
        }),
        update: dataFieldSchemas.pick({
            id: true,
            address: true,
            description: true,
        }),
    },
    params: {
        destroy: paramsFieldSchemas.pick({
            id: true,
        }),
    },
}
