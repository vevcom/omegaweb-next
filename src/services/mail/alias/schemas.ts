import { isOwnMailAddress, validMailAddressDomains } from '@/services/mail/constants'
import { z } from 'zod'

const validAddress = z.string().email().toLowerCase().refine(
    isOwnMailAddress,
    () => ({ message: `Domenet er ugyldig. Gyldige domener er: ${validMailAddressDomains().join(', ')}` })
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
