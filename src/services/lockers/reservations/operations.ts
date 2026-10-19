import '@pn-server-only'
import { lockerReservationAuth } from './auth'
import { lockerReservationSchemas } from './schemas'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'

/**
 * Reservations are deactivated, never deleted, once their end date has passed - which frees the
 * locker for a new one. That happens whenever lockers are read or reserved rather than on a
 * schedule, so an expired reservation can still be active until then.
 *
 * @param lockerId - The locker whose reservation to check. Every locker's when left out.
 */
const deactivateExpiredReservations = defineSubOperation({
    paramsSchema: () => lockerReservationSchemas.params.deactivateExpiredReservations,
    operation: () => async ({ prisma, params }) => {
        await prisma.lockerReservation.updateMany({
            where: {
                lockerId: params.lockerId,
                active: true,
                endDate: { lt: new Date() },
            },
            data: {
                active: false,
            },
        })
    },
})

export const lockerReservationOperations = {
    /**
     * Creates a new locker reservation for a given user and locker. A locker holds one active
     * reservation at a time, so one whose reservation is still running is refused.
     *
     * @param userId The user to create the reservation for.
     * @param lockerId The locker to reserve.
     *
     * @returns The newly created reservation object.
     */
    create: defineOperation({
        authorizer: ({ params, data }) => lockerReservationAuth.create.data({
            userId: params.userId,
            groupId: data.groupId,
        }),
        paramsSchema: lockerReservationSchemas.params.create,
        dataSchema: lockerReservationSchemas.data.create,
        operation: async ({ prisma, data, params }) => {
            await deactivateExpiredReservations.internalCall({ prisma, params: { lockerId: params.lockerId } })

            const activeReservation = await prisma.lockerReservation.findFirst({
                where: {
                    lockerId: params.lockerId,
                    active: true,
                },
                select: {
                    id: true,
                },
            })
            // Two reservations racing past this check are still stopped by the database, which holds
            // one active reservation per locker.
            if (activeReservation) {
                throw new ServiceError('DUPLICATE', 'Skapet er allerede reservert.')
            }

            return await prisma.lockerReservation.create({
                data: {
                    groupId: data.groupId,
                    endDate: data.endDate,
                    userId: params.userId,
                    lockerId: params.lockerId,
                }
            })
        },
    }),

    /**
     * Reads a locker reservation.
     *
     * @param id The ID of the reservation to read.
     *
     * @returns The reservation object.
     */
    read: defineOperation({
        authorizer: () => lockerReservationAuth.read,
        paramsSchema: lockerReservationSchemas.params.read,
        operation: ({ prisma, params: { id } }) => prisma.lockerReservation.findUniqueOrThrow({
            where: {
                id,
            },
        })
    }),

    /**
     * Updates an existing locker reservation. One that has ended is refused: it no longer holds the
     * locker, and changing it would not give it back.
     *
     * @param id The ID of the reservation to update.
     * @param data The new data to update the reservation with.
     *
     * @returns The updated reservation object.
     */
    update: defineOperation({
        authorizer: async ({ prisma, params, data }) => {
            const reservation = await prisma.lockerReservation.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                select: {
                    userId: true,
                },
            })
            return lockerReservationAuth.update.data({
                userId: reservation.userId,
                groupId: data.groupId,
            })
        },
        paramsSchema: lockerReservationSchemas.params.update,
        dataSchema: lockerReservationSchemas.data.update,
        operation: async ({ prisma, data, params: { id } }) => {
            const { count } = await prisma.lockerReservation.updateMany({
                where: {
                    id,
                    active: true,
                },
                data: {
                    groupId: data.groupId,
                    endDate: data.endDate,
                }
            })
            if (count === 0) {
                throw new ServiceError('BAD PARAMETERS', 'Reservasjonen er avsluttet, og kan ikke endres.')
            }
            return await prisma.lockerReservation.findUniqueOrThrow({
                where: {
                    id,
                },
            })
        },
    }),

    /**
     * Ends a reservation now, which frees the locker for a new one. The reservation is kept, as
     * expired ones are; its end date becomes now unless it was already set to end earlier.
     *
     * @param id The ID of the reservation to end.
     */
    deactivate: defineOperation({
        authorizer: async ({ prisma, params }) => {
            const reservation = await prisma.lockerReservation.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                select: {
                    userId: true,
                },
            })
            return lockerReservationAuth.deactivate.data({ userId: reservation.userId })
        },
        paramsSchema: lockerReservationSchemas.params.deactivate,
        operation: async ({ prisma, params: { id } }) => {
            const now = new Date()
            const { count } = await prisma.lockerReservation.updateMany({
                where: {
                    id,
                    active: true,
                    OR: [{ endDate: null }, { endDate: { gt: now } }],
                },
                data: {
                    active: false,
                    endDate: now,
                },
            })
            if (count === 0) {
                await prisma.lockerReservation.updateMany({
                    where: {
                        id,
                        active: true,
                    },
                    data: {
                        active: false,
                    },
                })
            }
        },
    }),

    deactivateExpiredReservations,
} as const
