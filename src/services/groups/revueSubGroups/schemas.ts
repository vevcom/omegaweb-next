import { userSchemas } from '@/services/users/schemas'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    id: z.number(),
    groupId: z.number(),
})

export const revueSubGroupSchemas = {
    params: {
        readAddableUsers: userSchemas.params.readPage.merge(paramsFieldSchemas.pick({ groupId: true })),
        destroy: paramsFieldSchemas.pick({ id: true }),
    },
}
