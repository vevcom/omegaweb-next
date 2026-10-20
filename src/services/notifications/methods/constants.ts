import { userBasicSelection } from '@/services/users/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Config for the weekly email digest (the `emailWeekly` notification method). Dispatching a
 * notification only queues it per recipient; the notification worker
 * (src/workers/definitions.ts) sends each user their queued notifications as one digest
 * mail on the configured weekday.
 */
export const weeklyDigest = {
    /** The day the digests go out, as a luxon weekday in Oslo time (1 = Monday, ..., 7 = Sunday). */
    osloWeekday: 1,
    subject: 'Ukentlig oppsummering fra Omegas nettsider',
} as const

/** Config for the immediate email dispatching. */
export const emailDispatch = {
    /**
     * How long a dispatch can hold its claim before it is considered dead and another worker may
     * retry the notification. A retry after a crash mid-send can duplicate mails to some
     * recipients, which beats silently losing the notification.
     */
    staleClaimMinutes: 5,
} as const

/** Config for the worker's push dispatching. */
export const pushDispatch = {
    maxAgeHours: 24,
    /** How long a push service holds on to a push for a browser that is offline. */
    ttlSeconds: 24 * 60 * 60,
    /** How long a push service may stay silent before the push counts as failed. */
    timeoutMs: 10 * 1000,
    /** How many pushes are sent to one push service at the same time. */
    maxConcurrentPerService: 50,
    /** Push services refuse payloads over 4 kB, so longer messages are cut. */
    maxBodyLength: 300,
    staleClaimMinutes: 5,
} as const

/**
 * The server's key pair for signing pushes, known as VAPID keys. Browsers subscribe with the public
 * key, so replacing the pair cuts off every saved push subscription.
 */
export const vapid = {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: `mailto:vevcom@${process.env.EMAIL_DOMAIN}`,
}

export const pushIsConfigured = Boolean(vapid.publicKey && vapid.privateKey)

export const pushRecipientIncluder = {
    user: {
        select: userBasicSelection,
    },
} as const satisfies Prisma.BrowserPushSubscriptionInclude
