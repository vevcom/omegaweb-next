import '@pn-server-only'
import { REGISTRATION_READER_TYPE } from './constants'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    note: z.string().max(200, 'Merknader kan ha maks 200 tegn'),
    name: z.string().min(2),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number().min(0),
    userId: z.number().min(0),
    registrationId: z.number().min(0),
    type: z.nativeEnum(REGISTRATION_READER_TYPE),
    provider: z.nativeEnum(PaymentProvider).optional(),
    amountFromBalance: z.coerce.number().nonnegative().default(0),
    manualFees: z.coerce.number().nonnegative().default(0),
    description: z.string().optional(),
})

/**
 * A page of one segment of the registration queue of an event - the registrations that took the
 * places of the event, or the ones on the waiting list past them.
 */
const readPage = readPageInputSchemaObject(
    paramsFieldSchemas.pick({
        id: true,
    }),
    paramsFieldSchemas.pick({
        eventId: true,
        type: true,
    }),
)

const userAndEvent = paramsFieldSchemas.pick({
    userId: true,
    eventId: true,
})

const registrationId = paramsFieldSchemas.pick({
    registrationId: true,
})

export const eventRegistrationSchemas = {
    data: {
        createGuest: dataFieldSchemas.pick({
            name: true,
            note: true,
        }),
        updateNotes: dataFieldSchemas.pick({
            note: true,
        }),
    },
    params: {
        create: userAndEvent,
        createGuest: paramsFieldSchemas.pick({
            eventId: true,
        }),
        readDotPunishmentOfUser: paramsFieldSchemas.pick({
            userId: true,
        }),
        readOfUser: userAndEvent,
        readPage,
        readPageDetailed: readPage,
        updateNotes: registrationId,
        destroy: registrationId,
        createPayment: paramsFieldSchemas.pick({
            userId: true,
            eventId: true,
            provider: true,
            amountFromBalance: true,
            manualFees: true,
            description: true,
        }),
    },
}
