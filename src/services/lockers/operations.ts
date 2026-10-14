import '@pn-server-only'
import { lockerReservationIncluder } from './constants'
import { lockersSchemas } from './schemas'
import { lockerAuth } from './auth'
import { lockerReservationOperations } from './reservations/operations'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'

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
} as const
