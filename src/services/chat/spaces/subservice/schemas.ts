import { z } from 'zod'
import { zfd } from 'zod-form-data'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(2).max(50),
    userIds: zfd.repeatable(z.coerce.number().array()),
})

const paramsFieldSchemas = z.object({
    spaceId: z.coerce.number().min(1),
    roomId: z.coerce.number().min(1),
})

const ofSpace = paramsFieldSchemas.pick({ spaceId: true })
const ofRoom = paramsFieldSchemas.pick({ spaceId: true, roomId: true })
const name = dataFieldSchemas.pick({ name: true })
const users = dataFieldSchemas.pick({ userIds: true })

export const chatSpaceSchemas = {
    data: {
        create: name,
        update: name,
        addMembers: users,
        removeMembers: users,
        createRoom: name,
        updateRoom: name,
    },
    params: {
        read: ofSpace,
        readMembers: ofSpace,
        update: ofSpace,
        destroy: ofSpace,
        addMembers: ofSpace,
        removeMembers: ofSpace,
        readRooms: ofSpace,
        createRoom: ofSpace,
        updateRoom: ofRoom,
        destroyRoom: ofRoom,
    },
}
