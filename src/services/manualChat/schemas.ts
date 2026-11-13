import { chatSpaceDataFieldSchemas } from '@/services/chat/spaces/subservice/schemas'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    spaceId: z.coerce.number().min(1),
    userId: z.coerce.number().min(1),
})

const ofSpace = paramsFieldSchemas.pick({ spaceId: true })
const users = chatSpaceDataFieldSchemas.pick({ userIds: true })

export const manualChatSpaceSchemas = {
    data: {
        create: chatSpaceDataFieldSchemas.pick({ name: true }),
        addAdmins: users,
        removeAdmins: users,
    },
    params: {
        read: ofSpace,
        addAdmins: ofSpace,
        removeAdmins: ofSpace,
        readAdministered: paramsFieldSchemas.pick({ userId: true }),
    },
}
