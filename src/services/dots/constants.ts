import type { Prisma } from '@/prisma-generated-pn-types'

const dotBaseDurationDays = 30

export const dotBaseDuration = 1000 * 60 * 60 * 24 * dotBaseDurationDays

export const dotsIncluder = {
    user: {
        select: {
            firstname: true,
            lastname: true,
            username: true
        }
    },
    accuser: {
        select: {
            firstname: true,
            lastname: true,
            username: true
        }
    }
} as const satisfies Prisma.DotInclude
