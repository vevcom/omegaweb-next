import { findChainIds } from '@/services/notifications/channels/subservice/helpers'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import type { MinimizedSubscription, ResolvedSubscription } from './types'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'

/**
 * A user's subscription to each channel given, from the rows they have. A row is the user's own
 * word on a channel; a channel they have none for follows the nearest channel above it they have
 * one for, as far as it offers the methods, and nothing anywhere up the chain means every method
 * off. The worker resolves recipients by the same rule, see methods/recipients.ts.
 */
export function resolveSubscriptions(
    channels: Pick<ExpandedNotificationChannel, 'id' | 'parentId' | 'availableMethods'>[],
    subscriptions: MinimizedSubscription[],
): ResolvedSubscription[] {
    const methodsByChannelId = new Map(subscriptions.map(subscription => [subscription.channelId, subscription.methods]))
    return channels.map(channel => {
        const decidingId = findChainIds(channel.id, channels).find(id => methodsByChannelId.has(id))
        const methods = decidingId === undefined ? allNotificationMethodsOff : methodsByChannelId.get(decidingId)
        return {
            channelId: channel.id,
            explicit: decidingId === channel.id,
            methods: booleanOperationOnMethods(methods ?? allNotificationMethodsOff, channel.availableMethods, 'AND'),
        }
    })
}
