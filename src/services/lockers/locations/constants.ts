import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * How many lockers a location holds, which is what decides whether it can be deleted.
 */
export const lockerLocationIncluder = {
    _count: {
        select: {
            lockers: true,
        },
    },
} as const satisfies Prisma.LockerLocationInclude
