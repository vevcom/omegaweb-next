import { notificationMethodsArray } from '@/services/notifications/constants'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

/** Whether every method on in `methods` is on in `availableMethods` too. */
export function validateMethods(
    availableMethods: NotificationMethodGeneral,
    methods: NotificationMethodGeneral
): boolean {
    return notificationMethodsArray.every(method => availableMethods[method] || !methods[method])
}

export function methodsAreEqual(lhs: NotificationMethodGeneral, rhs: NotificationMethodGeneral): boolean {
    return notificationMethodsArray.every(method => lhs[method] === rhs[method])
}

export function validateNewParent(
    channelId: number,
    newParentId: number,
    channels: ExpandedNotificationChannel[]
): boolean {
    return findValidParents(channelId, channels).map(channel => channel.id).includes(newParentId)
}

/** How many channels sit right under the channel. ROOT is its own parent and does not count itself. */
export function countChildren(channel: Pick<ExpandedNotificationChannel, 'id' | 'parentId' | '_count'>): number {
    return channel._count.children - (channel.parentId === channel.id ? 1 : 0)
}

type ChannelLink = Pick<ExpandedNotificationChannel, 'id' | 'parentId'>

/** The lookup findChainIds walks, built once for all the chains of a pass. */
export function channelsById(channels: ChannelLink[]): ReadonlyMap<number, ChannelLink> {
    return new Map(channels.map(channel => [channel.id, channel]))
}

/** The channel and the channels above it, nearest first, up to ROOT, which is its own parent. */
export function findChainIds(channelId: number, byId: ReadonlyMap<number, ChannelLink>): number[] {
    const chain: number[] = []
    let current = byId.get(channelId)
    while (current && !chain.includes(current.id)) {
        chain.push(current.id)
        current = byId.get(current.parentId)
    }
    return chain
}

/** The channels under a channel, at any depth. */
export function findDescendantIds(channelId: number, channels: ExpandedNotificationChannel[]): number[] {
    return Array.from(collectDescendantIds(channelId, channels, new Set()))
}

/**
 * The channels a channel may be moved under: every channel but itself and its descendants, as
 * putting it under one of those would cut its subtree off from ROOT.
 */
export function findValidParents(
    channelId: number,
    channels: ExpandedNotificationChannel[]
): ExpandedNotificationChannel[] {
    const descendantIds = collectDescendantIds(channelId, channels, new Set())
    return channels.filter(channel => channel.id !== channelId && !descendantIds.has(channel.id))
}

function collectDescendantIds(
    channelId: number,
    channels: ExpandedNotificationChannel[],
    found: Set<number>
): Set<number> {
    // ROOT is its own parent, and the visited set guards against any other loop in the data.
    channels
        .filter(channel => channel.parentId === channelId && channel.id !== channelId && !found.has(channel.id))
        .forEach(child => {
            found.add(child.id)
            collectDescendantIds(child.id, channels, found)
        })
    return found
}
