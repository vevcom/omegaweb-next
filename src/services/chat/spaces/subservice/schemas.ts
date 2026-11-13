import { z } from 'zod'
import { zfd } from 'zod-form-data'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(2).max(50),
    userIds: zfd.repeatable(z.coerce.number().array()),
})

const paramsFieldSchemas = z.object({
    spaceId: z.coerce.number().min(1),
})

const ofSpace = paramsFieldSchemas.pick({ spaceId: true })
const users = dataFieldSchemas.pick({ userIds: true })

export const chatSpaceSchemas = {
    data: {
        create: dataFieldSchemas.pick({ name: true }),
        update: dataFieldSchemas.pick({ name: true }),
        addMembers: users,
        removeMembers: users,
    },
    params: {
        read: ofSpace,
        readMembers: ofSpace,
        update: ofSpace,
        destroy: ofSpace,
        addMembers: ofSpace,
        removeMembers: ofSpace,
    },
}
