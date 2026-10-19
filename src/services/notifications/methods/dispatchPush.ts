import { pushDispatch, vapid } from './constants'
import { replaceSpecialSymbols, truncate } from './helpers'
import logger from '@/lib/logger'
import { sendNotification, WebPushError } from 'web-push'
import { Agent } from 'https'
import type { NotificationWithChannel, PushRecipient } from './types'

const pushServiceAgent = new Agent({ keepAlive: true, maxSockets: pushDispatch.maxConcurrentPerService })

const subscriptionGoneStatusCodes = [404, 410]

function isSubscriptionGone(reason: unknown) {
    return reason instanceof WebPushError && subscriptionGoneStatusCodes.includes(reason.statusCode)
}

/**
 * Pushes a notification to each of the given browsers. A push service answers 404 or 410 when a
 * subscription no longer exists, and those subscriptions are returned so they can be deleted. Any
 * other failure is logged, and the push is not retried.
 *
 * @returns How many pushes were accepted, and the ids of the subscriptions that are gone.
 */
export async function sendNotificationPushes(notification: NotificationWithChannel, recipients: PushRecipient[]) {
    const results = await Promise.allSettled(recipients.map(recipient => sendNotification(
        {
            endpoint: recipient.pushServiceUrl,
            keys: {
                p256dh: recipient.publicKey,
                auth: recipient.authSecret,
            },
        },
        JSON.stringify({
            title: replaceSpecialSymbols(notification.title, recipient.user),
            body: truncate(replaceSpecialSymbols(notification.message, recipient.user), pushDispatch.maxBodyLength),
            tag: `notification-${notification.id}`,
        }),
        {
            vapidDetails: vapid,
            TTL: pushDispatch.ttlSeconds,
            timeout: pushDispatch.timeoutMs,
            agent: pushServiceAgent,
        },
    )))

    const failures = results.flatMap((result, index) => (
        result.status === 'rejected' ? [{ recipient: recipients[index], reason: result.reason as unknown }] : []
    ))
    const gone = failures.filter(failure => isSubscriptionGone(failure.reason))
    const failed = failures.filter(failure => !isSubscriptionGone(failure.reason))

    if (failed.length > 0) {
        const reasons = new Set(failed.map(failure => (
            failure.reason instanceof WebPushError ? `HTTP ${failure.reason.statusCode}` : String(failure.reason)
        )))
        logger.warn(
            `Pushing notification ${notification.id} failed for ${failed.length} browsers: ${Array.from(reasons).join(', ')}`
        )
    }

    return {
        pushed: results.length - failures.length,
        goneSubscriptionIds: gone.map(failure => failure.recipient.id),
    }
}
