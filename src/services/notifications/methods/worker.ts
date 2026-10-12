import '@pn-server-only'
import { notificationMethodOperations } from './operations'
import { emailDispatch, weeklyDigest } from './constants'
import logger from '@/lib/logger'
import { prisma } from '@/prisma-pn-client-instance'
import { DateTime } from 'luxon'
import type { Prisma } from '@/prisma-generated-pn-types'

let stopping = false
let wakeUp: () => void = () => {}

// The sleep is interruptible so a stop signal ends the loop right away instead of waiting out
// the poll interval. The timer must also be cleared on wake-up - a pending timeout keeps the
// node process alive long after the loop has exited.
const sleep = (ms: number) => new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, ms)
    wakeUp = () => {
        clearTimeout(timeout)
        resolve()
    }
})

/**
 * Claims one email-undispatched notification, atomically, so concurrent workers never dispatch
 * the same one. Claims whose dispatch died mid-send go stale and become claimable again.
 */
async function claimNextEmailNotification(): Promise<number | null> {
    const staleClaimCutoff = new Date(Date.now() - emailDispatch.staleClaimMinutes * 60 * 1000)
    const claimable = {
        emailDispatchedAt: null,
        channel: {
            availableMethods: {
                email: true,
            },
        },
        OR: [
            { emailDispatchStartedAt: null },
            { emailDispatchStartedAt: { lt: staleClaimCutoff } },
        ],
    } satisfies Prisma.NotificationWhereInput

    const candidate = await prisma.notification.findFirst({
        where: claimable,
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    })
    if (!candidate) return null

    // Taking the claim re-checks the same conditions, which is what makes it atomic: postgres
    // makes a concurrent update of this row wait, then re-evaluates the where against the
    // committed result, so a worker that lost the race updates nothing and gets count 0.
    const { count } = await prisma.notification.updateMany({
        where: { id: candidate.id, ...claimable },
        data: { emailDispatchStartedAt: new Date() },
    })
    return count === 1 ? candidate.id : null
}

/**
 * @returns whether a notification was claimed and dispatched - if so there may be more waiting,
 * so the loop should come straight back rather than sleeping.
 */
async function dispatchNextEmailNotification(): Promise<boolean> {
    const notificationId = await claimNextEmailNotification()
    if (notificationId === null) return false

    const result = await notificationMethodOperations.dispatchEmail.internalCall({
        params: { notificationId },
    })
    logger.info(`Notification worker emailed notification ${notificationId} to ${result.recipients} recipients`)
    return true
}

/**
 * On the digest day, materializes the weekly outbox for everything created before the start of
 * that day (in Oslo time) - the cutoff is what makes repeated materializations harmless, and
 * notifications created during the day itself wait for the next digest. The outbox is then
 * drained whenever it has entries, which also retries digests that failed on an earlier tick.
 */
async function weeklyTick() {
    const nowInOslo = DateTime.now().setZone('Europe/Oslo')
    if (nowInOslo.weekday === weeklyDigest.osloWeekday) {
        await notificationMethodOperations.materializeWeeklyOutbox.internalCall({
            params: {
                before: nowInOslo.startOf('day').toJSDate(),
            },
        })
    }

    const result = await notificationMethodOperations.sendWeeklyMail.internalCall({})
    if (result.digests > 0 || result.failed > 0) {
        logger.info(`Notification worker sent ${result.digests} weekly digests (${result.failed} failed)`)
    }
}

/**
 * Polls until stopNotificationWorker is called, dispatching undispatched notifications by email
 * and sending the weekly digest mails when they are due. Errors (including the database being
 * unreachable, e.g. while the schema is being reset in dev) are logged and retried on the next
 * tick rather than killing the loop.
 */
export async function runNotificationWorker() {
    while (!stopping) {
        try {
            if (await dispatchNextEmailNotification()) continue
            await weeklyTick()
        } catch (error) {
            logger.error(`Notification worker tick failed: ${error}`)
        }
        await sleep(emailDispatch.pollIntervalMs)
    }
}

export function stopNotificationWorker() {
    stopping = true
    wakeUp()
}
