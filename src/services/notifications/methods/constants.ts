/**
 * Config for the weekly email digest (the `emailWeekly` notification method). Dispatching a
 * notification only queues it per recipient; the notification worker
 * (src/lib/notifications/worker.ts) sends each user their queued notifications as one digest
 * mail on the configured weekday.
 */
export const weeklyDigest = {
    /** The day the digests go out, as a luxon weekday in Oslo time (1 = Monday, ..., 7 = Sunday). */
    osloWeekday: 1,
    subject: 'Ukentlig oppsummering fra Omegas nettsider',
} as const

/** Config for the worker's immediate email dispatching. */
export const emailDispatch = {
    /** How often the worker polls for undispatched notifications (and due weekly digests). */
    pollIntervalMs: 5 * 1000,
    /**
     * How long a dispatch can hold its claim before it is considered dead and another worker may
     * retry the notification. A retry after a crash mid-send can duplicate mails to some
     * recipients, which beats silently losing the notification.
     */
    staleClaimMinutes: 5,
} as const
