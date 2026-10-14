import { z } from 'zod'

const dataFieldSchemas = z.object({
    // The form sends 'null' for a reservation made on behalf of no group.
    groupId: z.literal('null').transform(() => null).or(z.coerce.number().int()),
    // A reservation with no end date lasts until it is changed.
    endDate: z.literal('').or(z.coerce.date()).optional().transform(endDate => endDate || null),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    lockerId: z.number(),
    userId: z.number(),
})

const reservation = dataFieldSchemas.pick({
    groupId: true,
    endDate: true,
})

const reservationId = paramsFieldSchemas.pick({
    id: true,
})

export const lockerReservationSchemas = {
    data: {
        create: reservation,
        update: reservation,
    },
    params: {
        create: paramsFieldSchemas.pick({
            lockerId: true,
            userId: true,
        }),
        read: reservationId,
        update: reservationId,
        // Every locker's when no locker is given.
        deactivateExpiredReservations: paramsFieldSchemas.pick({
            lockerId: true,
        }).partial(),
    },
}
