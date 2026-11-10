import '@pn-server-only'
import { processNextImage } from '@/services/images/subservice/processingQueue'
import {
    dispatchNextEmailNotification,
    dispatchNextPushNotification,
    sendDueWeeklyDigests,
} from '@/services/notifications/methods/dispatchQueue'
import { pushIsConfigured } from '@/services/notifications/methods/constants'
import { cacheImageStore, originalImageStore } from '@/services/images/subservice/imageFiles'
import { ombulStore } from '@/services/ombul/store'
import { untrackedStoreFilesWorker } from '@/services/store/untrackedFiles'
import {
    cancelStaleLedgerTransactions,
    flagUnbalancedLedgerTransactions,
    reimburseUnclaimedPayments,
} from '@/services/ledger/sweeper'
import { runNextPaymentCompletionHook } from '@/services/ledger/transactions/paymentCompletionHooks'
import { syncMailServer } from '@/lib/mailServerSync/sync'
import { mailServerIsManaged } from '@/lib/mailServerSync/constants'
import { giveMissingVevenMailAddresses } from '@/services/users/missingVevenMailAddresses'
import { requeueNextUnpaidRegistration } from '@/services/events/registration/requeueUnpaid'
import logger from '@/lib/logger'
import type { Worker } from './types'

// Logged once, when the worker process loads its definitions.
if (!pushIsConfigured) {
    logger.warn('Notification worker will not push notifications, since the VAPID keys are not set')
}
if (!mailServerIsManaged) {
    logger.warn('Mail server sync will not run, since EMAIL_ADMIN_URL, EMAIL_ADMIN_USER and EMAIL_ADMIN_PASSWORD '
        + 'are not all set')
}

/**
 * Every background worker, by the name `main.ts` takes it by. What each one does, in what order and
 * how often is decided here; running them is main.ts's job.
 */
export const workers = {
    /** Produces the resized variants of uploaded images. */
    images: {
        name: 'Image processing worker',
        // How long to wait before looking again once no image is waiting to be processed.
        intervalMs: 2 * 1000,
        tick: processNextImage,
    },

    /** Sends all notifications: immediate emails and pushes, and the weekly digest mails. */
    notifications: {
        name: 'Notification worker',
        // How long to wait before looking again once there is nothing to send. Also how soon a due
        // weekly digest goes out.
        intervalMs: 5 * 1000,
        // Immediate emails and pushes come first; the digest is only looked at once there are none
        // left to send. Each method fails on its own, so a mail server that is down does not hold
        // back the pushes.
        tick: async () => {
            const [emailed, pushed] = await Promise.all([
                dispatchNextEmailNotification().catch((error: unknown) => {
                    logger.error(`Notification worker failed to dispatch an email: ${error}`)
                    return false
                }),
                dispatchNextPushNotification().catch((error: unknown) => {
                    logger.error(`Notification worker failed to dispatch a push: ${error}`)
                    return false
                }),
            ])
            if (emailed || pushed) return true
            await sendDueWeeklyDigests()
            return false
        },
    },

    /** Runs what a domain does once a payment for it has succeeded, e.g. confirming a cabin booking. */
    paymentCompletion: {
        name: 'Payment completion worker',
        // How long to wait before looking again once no payment is waiting. Short, so a paid booking
        // is confirmed right away.
        intervalMs: 1000,
        tick: runNextPaymentCompletionHook,
    },

    /** Sends unpaid registrations past their deadline to the back of the waiting list, where the variant asks for it. */
    unpaidRegistrations: {
        name: 'Unpaid registration worker',
        intervalMs: 60 * 1000,
        tick: requeueNextUnpaidRegistration,
    },

    /**
     * The store's workers, one per purpose, each made by the implementStore of the service that owns
     * the purpose. It destroys the purpose's orphans, the files no row refers to, moves its files
     * to where the purpose wants them, and reports the files a row of another purpose refers to.
     */
    ombulStore: ombulStore.worker,
    originalImageStore: originalImageStore.worker,
    cacheImageStore: cacheImageStore.worker,

    /** Destroys what is in the store without a StoreFile row, which no purpose's worker sees. */
    untrackedStoreFiles: untrackedStoreFilesWorker,

    /**
     * The ledger sweeper, see ledger/sweeper.ts. Stale transactions go first, since settling one can
     * leave an unclaimed payment behind. One check failing does not keep the others from running.
     */
    ledger: {
        name: 'Ledger sweeper',
        intervalMs: 60 * 1000,
        tick: async () => {
            try {
                await cancelStaleLedgerTransactions()
            } catch (error) {
                logger.error(`Ledger sweeper failed to cancel stale transactions: ${error}`)
            }

            try {
                await reimburseUnclaimedPayments()
            } catch (error) {
                logger.error(`Ledger sweeper failed to reimburse unclaimed payments: ${error}`)
            }

            try {
                await flagUnbalancedLedgerTransactions()
            } catch (error) {
                logger.error(`Ledger sweeper failed to flag unbalanced transactions: ${error}`)
            }
        },
    },

    /**
     * Keeps the mail server's domains, mailing lists and mailboxes in step with the addresses
     * of the aliases and the users here, see lib/mailServerSync/sync.ts. Does nothing while the
     * server is not managed.
     */
    mail: {
        name: 'Mail server sync',
        // How long a changed address, alias or membership takes to reach the mail server, at most.
        intervalMs: 60 * 1000,
        // The users without an address are given theirs first, so the server has a mailbox for each.
        tick: async () => {
            if (!mailServerIsManaged) return false
            await giveMissingVevenMailAddresses()
            return syncMailServer()
        },
    },
} as const satisfies Record<string, Worker>
