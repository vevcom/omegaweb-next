import type { Notification } from '@/prisma-generated-pn-types'

export type WeeklyDigestNotification = Notification & { channel: { name: string } }
