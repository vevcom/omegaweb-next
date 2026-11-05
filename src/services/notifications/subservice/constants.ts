import { allNotificationMethodsOn } from '@/services/notifications/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const availableNotificationMethodIncluder = {
    availableMethods: {
        select: allNotificationMethodsOn,
    },
} as const satisfies Prisma.NotificationChannelInclude
