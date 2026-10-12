import '@pn-server-only'
import { REGISTRATION_READER_TYPE } from './constants'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const baseSchema = z.object({
    note: z.string().max(200, 'Merknader kan ha maks 200 tegn'),
    name: z.string().min(2),
})

/**
 * A page of one segment of the registration queue of an event - the registrations that took the
 * places of the event, or the ones on the waiting list past them.
 */
const readPage = readPageInputSchemaObject(
    z.object({
        id: z.number(),
    }),
    z.object({
        eventId: z.number().min(0),
        type: z.nativeEnum(REGISTRATION_READER_TYPE),
    }),
)

export const eventRegistrationSchemas = {
    updateNotes: baseSchema.pick({
        note: true,
    }),

    createGuest: baseSchema.pick({
        name: true,
        note: true,
    }),

    readPage,
    readPageDetailed: readPage,
}
