import { REGISTRATION_READER_TYPE } from './constants'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { Zpn } from '@/lib/fields/zpn'
import { searchMaxLength } from '@/services/search/constants'
import { eventParamsFieldSchemas } from '@/services/events/schemas'
import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    note: z.string().max(200, 'Merknader kan ha maks 200 tegn'),
    quotaId: z.coerce.number().int(),
    slotId: z.coerce.number().int(),
    name: z.string().min(2),
    attended: Zpn.checkboxOrBoolean({ label: 'Møtt' }),
    manuallyPaid: Zpn.checkboxOrBoolean({ label: 'Betalt' }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number().min(0),
    userId: z.number().min(0),
    registrationId: z.number().min(0),
    variantId: z.number().min(0),
    quotaId: z.number().min(0),
    slotId: z.number().min(0),
    registeredById: z.number().min(0),
    type: z.nativeEnum(REGISTRATION_READER_TYPE),
    search: z.string().trim().max(searchMaxLength),
    direction: z.enum(['UP', 'DOWN']),
    provider: z.nativeEnum(PaymentProvider).optional(),
    amountFromBalance: z.coerce.number().nonnegative().default(0),
    manualFees: z.coerce.number().nonnegative().default(0),
    description: z.string().optional(),
    kinds: eventParamsFieldSchemas.shape.kinds,
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
    }).extend({
        variantId: paramsFieldSchemas.shape.variantId.optional(),
        search: paramsFieldSchemas.shape.search.optional(),
    }),
)

// Left out, the variant is the event's only one, the quota the first with a place, and the
// registration waits for a slot.
const variantIdOptional = { variantId: paramsFieldSchemas.shape.variantId.optional() }
const quotaIdOptional = { quotaId: paramsFieldSchemas.shape.quotaId.optional() }
const slotIdOptional = { slotId: paramsFieldSchemas.shape.slotId.optional() }

const userAndEvent = paramsFieldSchemas.pick({
    userId: true,
    eventId: true,
}).extend(variantIdOptional)

const registrationId = paramsFieldSchemas.pick({
    registrationId: true,
})

const eventId = paramsFieldSchemas.pick({
    eventId: true,
})

const eventAndVariant = eventId.extend(variantIdOptional)

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
        setManuallyPaid: dataFieldSchemas.pick({
            manuallyPaid: true,
        }),
        moveToQuota: dataFieldSchemas.pick({
            quotaId: true,
        }),
        moveToSlot: dataFieldSchemas.pick({
            slotId: true,
        }),
    },
    params: {
        create: userAndEvent.extend(slotIdOptional),
        createAsAdmin: userAndEvent.extend(quotaIdOptional).extend(slotIdOptional),
        createGuest: eventAndVariant.extend(quotaIdOptional).extend(slotIdOptional),
        readDotPunishmentOfUser: paramsFieldSchemas.pick({
            userId: true,
        }),
        readOfUser: userAndEvent,
        readUpcomingOfUser: paramsFieldSchemas.pick({
            userId: true,
            kinds: true,
        }),
        readPage,
        readPageDetailed: readPage,
        updateNotes: registrationId,
        destroy: registrationId,
        move: paramsFieldSchemas.pick({
            registrationId: true,
            direction: true,
        }),
        moveToQuota: registrationId,
        moveToSlot: registrationId,
        setManuallyPaid: registrationId,
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
        createDotsForNonattendingUsers: eventId,
        createPayment: paramsFieldSchemas.pick({
            userId: true,
            eventId: true,
            provider: true,
            amountFromBalance: true,
            manualFees: true,
            description: true,
        }).extend(variantIdOptional),
    },
}
