import { validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'

const validAddress = z.string().email().refine(
    address => validMailAddressDomains.includes(address.split('@')[1].trim()),
    `Domenet er ugyldig. Gyldige domener er: ${validMailAddressDomains.join(', ')}`
)

const dataFieldSchemas = z.object({
    address: validAddress,
    description: z.string(),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
})

const alias = paramsFieldSchemas.pick({
    id: true,
})

export const mailAliasSchemas = {
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
        update: alias,
        destroy: alias,
    },
}
