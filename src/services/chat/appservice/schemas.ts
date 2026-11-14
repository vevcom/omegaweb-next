import { z } from 'zod'

const paramsFieldSchemas = z.object({
    homeserverToken: z.string().nullable(),
})

const dataFieldSchemas = z.object({
    // Every event of the homeserver comes here, of any shape, and none is to make it send them again.
    events: z.array(z.unknown()).default([]),
})

export const chatAppserviceSchemas = {
    data: {
        receiveTransaction: dataFieldSchemas.pick({ events: true }),
    },
    params: {
        receiveTransaction: paramsFieldSchemas.pick({ homeserverToken: true }),
    },
}

/** A message as Matrix sends it, as far as the app reads it. A removed message has no content left. */
export const roomMessageEventSchema = z.object({
    type: z.literal('m.room.message'),
    event_id: z.string(),
    room_id: z.string(),
    sender: z.string(),
    origin_server_ts: z.number(),
    content: z.object({
        msgtype: z.string(),
        'm.mentions': z.object({
            user_ids: z.array(z.string()).optional(),
            room: z.boolean().optional(),
        }).optional(),
        'm.relates_to': z.object({ rel_type: z.string().optional() }).optional(),
    }),
})

export type RoomMessageEvent = z.infer<typeof roomMessageEventSchema>
