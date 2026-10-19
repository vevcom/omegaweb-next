import '@pn-server-only'
import { processNextImage } from '@/services/images/subservice/processingQueue'
import {
    dispatchNextEmailNotification,
    dispatchNextPushNotification,
    sendDueWeeklyDigests,
} from '@/services/notifications/methods/dispatchQueue'
import { pushIsConfigured } from '@/services/notifications/methods/constants'
import { destroyImageOrphans } from '@/services/images/subservice/imageFiles'
import { destroyOmbulOrphans } from '@/services/ombul/store'
import {
    cancelStaleLedgerTransactions,
    flagUnbalancedLedgerTransactions,
    reimburseUnclaimedPayments,
} from '@/services/ledger/sweeper'
import logger from '@/lib/logger'
import type { Worker } from './types'

// Logged once, when the worker process loads its definitions.
if (!pushIsConfigured) {
    logger.warn('Notification worker will not push notifications, since the VAPID keys are not set')
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

    /**
     * Destroys the orphans of the stores, the files no row refers to - see createOrphanDestroyer.
     * One store failing does not keep the other from being cleaned.
     */
    store: {
        name: 'Store worker',
        // A file is only destroyed after a day unreferenced, so looking more often than hourly gains
        // nothing.
        intervalMs: 60 * 60 * 1000,
        tick: async () => {
            try {
                await destroyImageOrphans()
            } catch (error) {
                logger.error(`Store worker failed to destroy the orphans of the images store: ${error}`)
            }

            try {
                await destroyOmbulOrphans()
            } catch (error) {
                logger.error(`Store worker failed to destroy the orphans of the ombul store: ${error}`)
            }
        },
    },

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
} as const satisfies Record<string, Worker>
