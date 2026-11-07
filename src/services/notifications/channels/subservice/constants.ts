import { allNotificationMethodsOn } from '@/services/notifications/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

/** A channel with the methods it offers and how many channels sit under it, which for ROOT counts itself. */
export const availableNotificationMethodIncluder = {
    availableMethods: {
        select: allNotificationMethodsOn,
    },
    _count: {
        select: { children: true },
    },
} as const satisfies Prisma.NotificationChannelInclude
