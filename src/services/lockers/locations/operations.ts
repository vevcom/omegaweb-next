import '@pn-server-only'
import { lockerLocationAuth } from './auth'
import { lockersSchemas } from '@/services/lockers/schemas'
import { defineOperation } from '@/services/serviceOperation'

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
        dataSchema: lockersSchemas.createLocation,
        operation: async ({ prisma, data }) => prisma.lockerLocation.create({
            data: {
                building: data.building,
                floor: data.floor
            }
        })
    }),

    /**
     * Reads all locker locations.
     *
     * @returns All locker location objects.
     */
    readAll: defineOperation({
        authorizer: () => lockerLocationAuth.readAll,
        operation: async ({ prisma }) => prisma.lockerLocation.findMany()
    }),
} as const
