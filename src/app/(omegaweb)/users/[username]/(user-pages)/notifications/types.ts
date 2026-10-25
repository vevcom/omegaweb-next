import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'
import type { Subscription } from '@/services/notifications/subscription/types'


export type NotificationBranch = ExpandedNotificationChannel & {
    children: NotificationBranch[],
    subscription?: Subscription | {
        new: true,
        methods: NotificationMethodGeneral
    },
}
