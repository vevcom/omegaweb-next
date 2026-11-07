import type { notificationMethodIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'


export type Subscription = Prisma.NotificationSubscriptionGetPayload<{
    include: typeof notificationMethodIncluder
}>

export type MinimizedSubscription = Pick<Subscription, 'channelId' | 'methods'>

/**
 * The user's subscription to a channel as their rows resolve: their own row for it when they have
 * one, else the nearest row above it, cut to what the channel offers.
 */
export type ResolvedSubscription = MinimizedSubscription & {
    /** Whether the user has a row for the channel itself, rather than following one above. */
    explicit: boolean,
}
