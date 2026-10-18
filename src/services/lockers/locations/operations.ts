import '@pn-server-only'
import { lockerLocationAuth } from './auth'
import { lockerLocationIncluder } from './constants'
import { lockerLocationSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'

export const lockerLocationOperations = {
    /**
     * Creates a new locker location.
     *
     * @param data - Building and floor of the locker location.
     *
     * @returns The newly created locker location object.
     */
    create: defineOperation({
        authorizer: () => lockerLocationAuth.create,
        dataSchema: lockerLocationSchemas.data.create,
        operation: async ({ prisma, data }) => prisma.lockerLocation.create({
            data: {
                building: data.building,
                floor: data.floor
            }
        })
    }),

    /**
     * Reads all locker locations, with how many lockers each holds.
     *
     * @returns All locker location objects.
     */
    readAll: defineOperation({
        authorizer: () => lockerLocationAuth.readAll,
        operation: async ({ prisma }) => prisma.lockerLocation.findMany({
            include: lockerLocationIncluder,
        })
    }),

    /**
     * Renames a locker location. Its lockers point at the location by building and floor, and the
     * database carries the new ones over to them.
     *
     * @param id - The location to rename.
     * @param data - The new building and floor.
     *
     * @returns The updated locker location object.
     */
    update: defineOperation({
        authorizer: () => lockerLocationAuth.update,
        paramsSchema: lockerLocationSchemas.params.update,
        dataSchema: lockerLocationSchemas.data.update,
        operation: async ({ prisma, params, data }) => prisma.lockerLocation.update({
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
     * Deletes a locker location. A location that still holds lockers is refused, since the lockers
     * would be left with nowhere to be; the database refuses it too, should a locker be created there
     * in the meantime.
     *
     * @param id - The location to delete.
     */
    destroy: defineOperation({
        authorizer: () => lockerLocationAuth.destroy,
        paramsSchema: lockerLocationSchemas.params.destroy,
        operation: async ({ prisma, params }) => {
            const location = await prisma.lockerLocation.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                include: lockerLocationIncluder,
            })
            if (location._count.lockers > 0) {
                throw new ServiceError(
                    'UNPERMITTED CASCADE',
                    `${location.building} ${location.floor}. etasje har ${location._count.lockers} skap. ` +
                    'Slett skapene før lokasjonen.'
                )
            }

            await prisma.lockerLocation.delete({
                where: {
                    id: params.id,
                },
            })
        }
    }),
} as const
