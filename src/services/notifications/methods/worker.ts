import '@pn-server-only'
import { notificationMethodOperations } from './operations'
import { emailDispatch, pushDispatch, pushIsConfigured, weeklyDigest } from './constants'
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
 * Claims the oldest claimable notification, atomically, so concurrent workers never dispatch the
 * same one. The claimable filter must also accept claims that went stale, so a dispatch that died
 * mid-send is retried.
 */
async function claimNextNotification(
    claimable: Prisma.NotificationWhereInput,
    claim: Prisma.NotificationUpdateManyMutationInput,
): Promise<number | null> {
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
        data: claim,
    })
    return count === 1 ? candidate.id : null
}

function claimNextEmailNotification() {
    const staleClaimCutoff = new Date(Date.now() - emailDispatch.staleClaimMinutes * 60 * 1000)
    return claimNextNotification({
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
    }, { emailDispatchStartedAt: new Date() })
}

function claimNextPushNotification() {
    const staleClaimCutoff = new Date(Date.now() - pushDispatch.staleClaimMinutes * 60 * 1000)
    return claimNextNotification({
        pushDispatchedAt: null,
        createdAt: {
            gt: new Date(Date.now() - pushDispatch.maxAgeHours * 60 * 60 * 1000),
        },
        channel: {
            availableMethods: {
                push: true,
            },
        },
        OR: [
            { pushDispatchStartedAt: null },
            { pushDispatchStartedAt: { lt: staleClaimCutoff } },
        ],
    }, { pushDispatchStartedAt: new Date() })
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

async function dispatchNextPushNotification(): Promise<boolean> {
    if (!pushIsConfigured) return false

    const notificationId = await claimNextPushNotification()
    if (notificationId === null) return false

    const result = await notificationMethodOperations.dispatchPush.internalCall({
        params: { notificationId },
    })
    logger.info(`Notification worker pushed notification ${notificationId} to ${result.pushed} browsers`)
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

async function withErrorsLogged<Result>(task: string, run: () => Promise<Result>, fallback: Result) {
    try {
        return await run()
    } catch (error) {
        logger.error(`Notification worker ${task} failed: ${error}`)
        return fallback
    }
}

/**
 * Polls until stopNotificationWorker is called, dispatching undispatched notifications by email
 * and push, and sending the weekly digest mails when they are due. Errors are logged and retried on
 * the next tick rather than killing the loop, which also covers the database being unreachable while
 * the schema is reset in dev. Each method fails on its own, so a mail server that is down does not
 * hold back the pushes.
 */
export async function runNotificationWorker() {
    if (!pushIsConfigured) {
        logger.warn('Notification worker will not push notifications, since the VAPID keys are not set')
    }

    while (!stopping) {
        const [emailed, pushed] = await Promise.all([
            withErrorsLogged('email dispatch', dispatchNextEmailNotification, false),
            withErrorsLogged('push dispatch', dispatchNextPushNotification, false),
        ])
        if (emailed || pushed) continue

        await withErrorsLogged('weekly digest', weeklyTick, undefined)
        await sleep(emailDispatch.pollIntervalMs)
    }
}

export function stopNotificationWorker() {
    stopping = true
    wakeUp()
}
