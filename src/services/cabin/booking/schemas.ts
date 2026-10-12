import { dateLessThan, dateLessThanOrEqualTo } from '@/lib/dates/comparison'
import { Zpn } from '@/lib/fields/zpn'
import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const fieldSchemas = z.object({
    id: z.number(),
    userId: z.number(),
    bookingId: z.number(),
    secret: z.string().min(1),
    bookingProducts: z.array(z.object({
        cabinProductId: z.number(),
        quantity: z.number().int().min(1),
    })),
    provider: z.nativeEnum(PaymentProvider).optional(),
    amountFromBalance: z.coerce.number().nonnegative().default(0),
    manualFees: z.coerce.number().nonnegative().default(0),
    description: z.string().optional(),
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
    })
})

const startsBeforeEndAndNotInThePast = (data: { start: Date, end: Date }) =>
    dateLessThan(data.start, data.end) && dateLessThanOrEqualTo(new Date(), data.start)
const datesMessage = 'Startdatoen må være før sluttdatoen, og kan ikke være i fortiden.'

const bookingUserAttached = fieldSchemas.pick({
    start: true,
    end: true,
    tenantNotes: true,
    acceptedTerms: true,
    numberOfMembers: true,
    numberOfNonMembers: true,
}).refine(startsBeforeEndAndNotInThePast, datesMessage)

const bookingNoUser = fieldSchemas.pick({
    start: true,
    end: true,
    tenantNotes: true,
    acceptedTerms: true,
    firstname: true,
    lastname: true,
    email: true,
    mobile: true,
}).refine(startsBeforeEndAndNotInThePast, datesMessage)

export const cabinBookingSchemas = {
    createCabinBookingUserAttached: bookingUserAttached,
    createBedBookingUserAttached: bookingUserAttached,
    createCabinBookingNoUser: bookingNoUser,
    createBedBookingNoUser: bookingNoUser,
} as const

const bookingUserAttachedParams = fieldSchemas.pick({
    userId: true,
    bookingProducts: true,
})

const bookingNoUserParams = fieldSchemas.pick({
    bookingProducts: true,
})

const bookingAccess = fieldSchemas.pick({
    bookingId: true,
    secret: true,
})

export const cabinBookingParamsSchemas = {
    createCabinBookingUserAttached: bookingUserAttachedParams,
    createBedBookingUserAttached: bookingUserAttachedParams,
    createCabinBookingNoUser: bookingNoUserParams,
    createBedBookingNoUser: bookingNoUserParams,
    read: fieldSchemas.pick({
        id: true,
    }),
    createPayment: fieldSchemas.pick({
        bookingId: true,
        secret: true,
        provider: true,
        amountFromBalance: true,
        manualFees: true,
        description: true,
    }),
    releaseReservation: bookingAccess,
} as const
