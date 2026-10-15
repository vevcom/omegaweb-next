import { notificationMethodsArray } from '@/services/notifications/constants'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

/**
 * Validates the available notification methods against the default methods.
 * @param availableMethods - The available notification methods.
 * @param defaultMethods - The default notification methods.
 * @returns A boolean indicating whether the available methods are valid.
 */
export function validateMethods(
    availableMethods: NotificationMethodGeneral,
    defaultMethods: NotificationMethodGeneral
): boolean {
    return notificationMethodsArray.every(method => availableMethods[method] || !defaultMethods[method])
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
