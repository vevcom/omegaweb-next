import { Zpn } from '@/lib/fields/zpn'
import { Permission } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(10, 'minimum lengde 10').max(100, 'maksimum lengde 100'),
    expiresAt: z.coerce.date().optional(),
    active: Zpn.checkboxOrBoolean({ label: 'Aktiv' }),
    permissions: Zpn.enumListCheckboxFriendly({ label: 'Tillatelser', enum: Permission })
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    name: z.string(),
    expiresAt: z.date().nullable(),
    active: z.boolean(),
})

const apiKeyId = paramsFieldSchemas.pick({
    id: true,
})

export const apiKeySchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
        }),
        update: dataFieldSchemas.partial().pick({
            name: true,
            expiresAt: true,
            active: true,
            permissions: true
        }),
    },
    params: {
        read: z.union([
            apiKeyId,
            paramsFieldSchemas.pick({
                name: true,
            }),
        ]),
        updateIfExpired: paramsFieldSchemas.pick({
            id: true,
            expiresAt: true,
            active: true,
        }),
        readWithHash: apiKeyId,
        update: apiKeyId,
        destroy: apiKeyId,
    },
}
