import { mailParamsFieldSchemas } from '@/services/mail/schemas'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
    markOwnedByUserId: mailParamsFieldSchemas.shape.markOwnedByUserId,
})

export const mailTraversalSchemas = {
    params: {
        read: paramsFieldSchemas.pick({
            id: true,
            markOwnedByUserId: true,
        }),
    },
}
