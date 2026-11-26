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

const eventFieldSchemas = {
    event_id: z.string(),
    room_id: z.string(),
    sender: z.string(),
    origin_server_ts: z.number(),
}
const besideWhatIsSaidSchemas = {
    'm.mentions': z.object({
        user_ids: z.array(z.string()).optional(),
        room: z.boolean().optional(),
    }).optional(),
    'm.relates_to': z.object({ rel_type: z.string().optional() }).optional(),
}

/**
 * A message as Matrix sends it, as far as the app reads it. A removed message has no content left.
 * One written in an encrypted room comes as `m.room.encrypted`: the app is told who wrote, where
 * and when, and not what. Whom it mentions and what it is of stand beside the encrypted part,
 * where the client that wrote it put them, and nothing says they are true: the homeserver passes
 * them on from anyone.
 */
export const roomMessageEventSchema = z.discriminatedUnion('type', [
    z.object({
        ...eventFieldSchemas,
        type: z.literal('m.room.message'),
        content: z.object({ msgtype: z.string(), ...besideWhatIsSaidSchemas }),
    }),
    z.object({
        ...eventFieldSchemas,
        type: z.literal('m.room.encrypted'),
        content: z.object({ algorithm: z.string(), ...besideWhatIsSaidSchemas }),
    }),
])

export type RoomMessageEvent = z.infer<typeof roomMessageEventSchema>

/** A removal of a message as Matrix sends it. Which message stands in one of two places, by the room's version. */
export const roomRedactionEventSchema = z.object({
    type: z.literal('m.room.redaction'),
    redacts: z.string().optional(),
    content: z.object({ redacts: z.string().optional() }).optional(),
})
