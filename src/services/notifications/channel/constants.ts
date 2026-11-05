import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const availableNotificationMethodIncluder = {
    availableMethods: {
        select: allNotificationMethodsOn,
    },
} as const
