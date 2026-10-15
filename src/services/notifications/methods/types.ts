import type { Notification } from '@/prisma-generated-pn-types'

/** A notification with the name of the channel it was sent on, which the mails name. */
export type NotificationWithChannel = Notification & { channel: { name: string } }

export type WeeklyDigestNotification = NotificationWithChannel
