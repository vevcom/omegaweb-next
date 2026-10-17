import { REGISTRATION_READER_TYPE } from './constants'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { Zpn } from '@/lib/fields/zpn'
import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    note: z.string().max(200, 'Merknader kan ha maks 200 tegn'),
    name: z.string().min(2),
    attended: Zpn.checkboxOrBoolean({ label: 'Møtt' }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number().min(0),
    userId: z.number().min(0),
    registrationId: z.number().min(0),
    registeredById: z.number().min(0),
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

const eventId = paramsFieldSchemas.pick({
    eventId: true,
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
        setAttendance: dataFieldSchemas.pick({
            attended: true,
        }),
    },
    params: {
        create: userAndEvent,
        createGuest: eventId,
        readDotPunishmentOfUser: paramsFieldSchemas.pick({
            userId: true,
        }),
        readOfUser: userAndEvent,
        readPage,
        readPageDetailed: readPage,
        updateNotes: registrationId,
        destroy: registrationId,
        registerAttendance: paramsFieldSchemas.pick({
            userId: true,
            eventId: true,
            registeredById: true,
        }),
        setAttendance: paramsFieldSchemas.pick({
            registrationId: true,
            registeredById: true,
        }),
        readAttendanceCounts: eventId,
        readNotAttended: eventId,
        createDot: eventId,
        createDotsForMany: eventId,
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
