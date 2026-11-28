import { z } from 'zod'

export const chatAppserviceParamsFieldSchemas = z.object({
    homeserverToken: z.string().nullable(),
})

export const chatAppserviceDataFieldSchemas = z.object({
    // Every event of the homeserver comes here, of any shape, and none is to make it send them again.
    events: z.array(z.unknown()).default([]),
})

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

/** A removal of a message as Matrix sends it. Which message stands in one of two places, by the room's version. */
export const roomRedactionEventSchema = z.object({
    type: z.literal('m.room.redaction'),
    redacts: z.string().optional(),
    content: z.object({ redacts: z.string().optional() }).optional(),
})
