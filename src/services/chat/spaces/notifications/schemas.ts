import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string(),
})

const paramsFieldSchemas = z.object({
    spaceId: z.number(),
    mentionsNotificationChannelId: z.number(),
    allNotificationChannelId: z.number(),
})

const ofSpace = paramsFieldSchemas.pick({ spaceId: true })
const spaceName = dataFieldSchemas.pick({ name: true })

export const chatSpaceNotificationSchemas = {
    data: {
        createChannels: spaceName,
        renameChannels: spaceName,
    },
    params: {
        createChannels: ofSpace,
        renameChannels: ofSpace,
        destroyChannels: paramsFieldSchemas.pick({
            mentionsNotificationChannelId: true,
            allNotificationChannelId: true,
        }),
    },
}
