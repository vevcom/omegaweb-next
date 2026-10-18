import '@pn-server-only'
import { lockerReservationIncluder } from './constants'
import { lockersSchemas } from './schemas'
import { lockerAuth } from './auth'
import { lockerReservationOperations } from './reservations/operations'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { ServiceError } from '@/services/error'

export const lockerOperations = {
    /**
     * Creates a new locker.
     *
     * @param data - The locker data.
     *
     * @returns The newly created locker object.
     */
    create: defineOperation({
        authorizer: () => lockerAuth.create,
        dataSchema: lockersSchemas.data.create,
        operation: async ({ prisma, data }) => await prisma.locker.create({
            data,
        })
    }),

    /**
     * Reads a locker. Expired locker reservations are deactivated when reading.
     *
     * @param id - The id of the locker.
     *
     * @returns The locker object.
     */
    read: defineOperation({
        authorizer: () => lockerAuth.read,
        paramsSchema: lockersSchemas.params.read,
        operation: async ({ prisma, params: { id } }) => {
            await lockerReservationOperations.deactivateExpiredReservations.internalCall({
                prisma,
                params: { lockerId: id },
            })

            return await prisma.locker.findUniqueOrThrow({
                where: {
                    id,
                },
                include: lockerReservationIncluder
            })
        }
    }),

    /**
     * Reads a page of lockers. Expired locker reservations are deactivated when reading.
     *
     * @param paging - The paging data.
     *
     * @returns A list of locker objects.
     */
    readPage: defineOperation({
        authorizer: () => lockerAuth.readPage,
        paramsSchema: lockersSchemas.params.readPage,
        operation: async ({ prisma, params }) => {
            await lockerReservationOperations.deactivateExpiredReservations.internalCall({ prisma, params: {} })

            return await prisma.locker.findMany({
                ...cursorPagingSelection(params.paging.page),
                orderBy: {
                    id: 'asc'
                },
                include: lockerReservationIncluder,
            })
        }
    }),

    /**
     * Moves a locker to another location. Its number stays, since that is what the QR code on the
     * locker points at.
     *
     * @param id - The locker to move.
     * @param data - The building and floor to move it to, which must be an existing location.
     *
     * @returns The updated locker object.
     */
    update: defineOperation({
        authorizer: () => lockerAuth.update,
        paramsSchema: lockersSchemas.params.update,
        dataSchema: lockersSchemas.data.update,
        operation: async ({ prisma, params, data }) => prisma.locker.update({
            where: {
                id: params.id,
            },
            data: {
                building: data.building,
                floor: data.floor,
            },
        })
    }),

    /**
     * Deletes a locker, with the reservations of it that have ended. A locker that is reserved is
     * refused: the reservation has to be ended first, so nobody loses a locker without it showing.
     *
     * @param id - The locker to delete.
     */
    destroy: defineOperation({
        authorizer: () => lockerAuth.destroy,
        paramsSchema: lockersSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            await lockerReservationOperations.deactivateExpiredReservations.internalCall({
                prisma,
                params: { lockerId: params.id },
            })

            await prisma.$transaction(async tx => {
                await tx.locker.findUniqueOrThrow({
                    where: {
                        id: params.id,
                    },
                })
                const activeReservations = await tx.lockerReservation.count({
                    where: {
                        lockerId: params.id,
                        active: true,
                    },
                })
                if (activeReservations > 0) {
                    throw new ServiceError(
                        'UNPERMITTED CASCADE',
                        'Skapet er reservert. Frigi skapet før det slettes.'
                    )
                }

                // A reservation made in the meantime is active, so it is not deleted here, and the
                // locker it points at cannot be deleted either: the transaction then rolls back.
                await tx.lockerReservation.deleteMany({
                    where: {
                        lockerId: params.id,
                        active: false,
                    },
                })
                await tx.locker.delete({
                    where: {
                        id: params.id,
                    },
                })
            })
        }
    }),
} as const
