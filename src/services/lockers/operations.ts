import '@pn-server-only'
import { lockerReservationIncluder } from './reservations/constants'
import { lockersSchemas } from './schemas'
import { lockerAuth } from './auth'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { z } from 'zod'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { LockerWithReservation } from '@/services/lockers/types'

export async function updateLockerReservationIfExpired(prisma: Prisma.TransactionClient, locker: LockerWithReservation) {
    if (!locker.LockerReservation.length) return

    const reservation = locker.LockerReservation[0]

    if (reservation.endDate === null) return

    if (reservation.endDate.getTime() < Date.now()) {
        const updateResult = await prisma.lockerReservation.update({
            where: {
                id: locker.LockerReservation[0].id
            },
            data: {
                active: false
            }
        })
        if (!updateResult) {
            throw new ServiceError('NOT FOUND', 'lockerReservation not found while updating')
        }
        locker.LockerReservation = []
    }
}
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
        dataSchema: lockersSchemas.create,
        operation: async ({ prisma, data }) => await prisma.locker.create({
            data,
        })
    }),

    /**
     * Reads a locker. Expired locker reservations are updated when reading.
     *
     * @param id - The id of the locker.
     *
     * @returns The locker object.
     */
    read: defineOperation({
        authorizer: () => lockerAuth.read,
        paramsSchema: z.object({
            id: z.number(),
        }),
        operation: async ({ prisma, params: { id } }) => {
            const locker = await prisma.locker.findUniqueOrThrow({
                where: {
                    id,
                },
                include: lockerReservationIncluder
            })

            await updateLockerReservationIfExpired(prisma, locker)

            return locker
        }
    }),

    /**
     * Reads a page of lockers. Expired locker reservations are updated when reading.
     *
     * @param paging - The paging data.
     *
     * @returns A list of locker objects.
     */
    readPage: defineOperation({
        authorizer: () => lockerAuth.readPage,
        paramsSchema: lockersSchemas.readPage,
        operation: async ({ prisma, params }) => {
            const lockers = await prisma.locker.findMany({
                ...cursorPagingSelection(params.paging.page),
                orderBy: {
                    id: 'asc'
                },
                include: lockerReservationIncluder,
            })

            await Promise.all(lockers.map((locker) => updateLockerReservationIfExpired(prisma, locker)))

            return lockers
        }
    }),
} as const
