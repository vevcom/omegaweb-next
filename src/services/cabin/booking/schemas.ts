import { dateLessThan, dateLessThanOrEqualTo } from '@/lib/dates/comparison'
import { Zpn } from '@/lib/fields/zpn'
import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
    tenantNotes: z.string().optional(),
    numberOfMembers: z.coerce.number().min(0),
    numberOfNonMembers: z.coerce.number().min(0),
    firstname: z.string().min(2),
    lastname: z.string().min(2),
    email: z.string().email(),
    mobile: z.string().regex(/^\+?\d{4,20}$/, { message: 'Skriv kun tall, uten mellomrom.' }),
    acceptedTerms: Zpn.checkboxOrBoolean({
        label: '',
        message: 'Du må godta vilkårene for å bruk siden.'
    }),
    ledgerAccountId: z.coerce.number().int(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    userId: z.number(),
    bookingId: z.number(),
    // Booking secrets are 48 hex characters. The cap keeps an oversized one from costing memory and time
    // in the comparison, which walks the longer of the two.
    secret: z.string().min(1).max(128),
    bookingProducts: z.array(z.object({
        cabinProductId: z.number(),
        quantity: z.number().int().min(1),
    })),
    provider: z.nativeEnum(PaymentProvider).optional(),
    amountFromBalance: z.coerce.number().nonnegative().default(0),
    manualFees: z.coerce.number().nonnegative().default(0),
    description: z.string().optional(),
})

const startsBeforeEndAndNotInThePast = (data: { start: Date, end: Date }) =>
    dateLessThan(data.start, data.end) && dateLessThanOrEqualTo(new Date(), data.start)
const datesMessage = 'Startdatoen må være før sluttdatoen, og kan ikke være i fortiden.'

const bookingUserAttached = dataFieldSchemas.pick({
    start: true,
    end: true,
    tenantNotes: true,
    acceptedTerms: true,
    numberOfMembers: true,
    numberOfNonMembers: true,
}).refine(startsBeforeEndAndNotInThePast, datesMessage)

const bookingNoUser = dataFieldSchemas.pick({
    start: true,
    end: true,
    tenantNotes: true,
    acceptedTerms: true,
    firstname: true,
    lastname: true,
    email: true,
    mobile: true,
}).refine(startsBeforeEndAndNotInThePast, datesMessage)

const bookingUserAttachedParams = paramsFieldSchemas.pick({
    userId: true,
    bookingProducts: true,
})

const bookingNoUserParams = paramsFieldSchemas.pick({
    bookingProducts: true,
})

const bookingAccess = paramsFieldSchemas.pick({
    bookingId: true,
    secret: true,
})

export const cabinBookingSchemas = {
    data: {
        createCabinBookingUserAttached: bookingUserAttached,
        createBedBookingUserAttached: bookingUserAttached,
        createCabinBookingNoUser: bookingNoUser,
        createBedBookingNoUser: bookingNoUser,
        connectToLedger: dataFieldSchemas.pick({
            ledgerAccountId: true,
        }),
    },
    params: {
        createCabinBookingUserAttached: bookingUserAttachedParams,
        createBedBookingUserAttached: bookingUserAttachedParams,
        createCabinBookingNoUser: bookingNoUserParams,
        createBedBookingNoUser: bookingNoUserParams,
        read: paramsFieldSchemas.pick({
            id: true,
        }),
        createPayment: paramsFieldSchemas.pick({
            bookingId: true,
            secret: true,
            provider: true,
            amountFromBalance: true,
            manualFees: true,
            description: true,
        }),
        releaseReservation: bookingAccess,
    },
}
