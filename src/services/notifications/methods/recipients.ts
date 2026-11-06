import { passesVisibilityWhere } from '@/auth/visibility/passesVisibilityWhere'
import { whoCanRegisterSelection, whoCanRegisterWhere } from '@/services/events/access'
import { visibilityIncluder } from '@/services/visibility/implement'
import { userPartitions } from '@/services/users/constants'
import { channelsById, findChainIds } from '@/services/notifications/channels/subservice/helpers'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { NotificationMethods } from '@/services/notifications/types'
import type { Permission, Prisma } from '@/prisma-generated-pn-types'

/** Everything the worker needs to resolve a notification's recipients and dispatch it. */
export const notificationDispatchIncluder = {
    channel: {
        include: {
            availableMethods: true,
            mailAlias: true,
        },
    },
    usersTargeted: {
        select: {
            id: true,
        },
    },
    visibility: {
        include: visibilityIncluder,
    },
    canRegisterForEvent: {
        select: whoCanRegisterSelection,
    },
    registeredForEvent: {
        select: { id: true },
    },
} as const satisfies Prisma.NotificationInclude

export type DispatchableNotification = Prisma.NotificationGetPayload<{
    include: typeof notificationDispatchIncluder
}>

/**
 * The user filter for who receives a notification through the given method. It is evaluated when
 * the worker dispatches - not when the notification was created - so subscription, membership and
 * visibility changes in between count. A recipient must
 * 1. be subscribed to the notification's channel with the method on, by the row they have for it
 *    or, having none, by the row for the nearest channel above it, see subscribedWhere,
 * 2. be among the targeted users, when the notification targets anyone,
 * 3. pass the notification's visibility, when it has one, see passesVisibilityWhere,
 * 4. hold the notification's permission, when it has one: as a default permission or through an
 *    active membership of a group holding it, as readPermissionsOfUser resolves permissions, and
 * 5. be able to register for the event the notification is for, when it is for one, as the event's
 *    quotas are now, see whoCanRegisterWhere, and
 * 6. be registered for the event the notification is for, when it is for one, on a place or
 *    waiting for one, as the registrations are now.
 * Archived users receive nothing.
 */
export function recipientsWhere(
    notification: DispatchableNotification,
    method: NotificationMethods,
    defaultPermissions: Permission[],
    /** The notification's channel and the channels above it, nearest first, see readChannelChainIds. */
    channelChainIds: number[],
): Prisma.UserWhereInput {
    const { permission } = notification
    // A channel that does not offer the method sends nothing by it, whatever is subscribed above.
    if (!notification.channel.availableMethods[method]) return { id: { in: [] } }
    return {
        ...userPartitions.unarchived,
        ...subscribedWhere(channelChainIds, method),
        ...(notification.usersTargeted.length > 0 ? {
            id: {
                in: notification.usersTargeted.map(user => user.id),
            },
        } : {}),
        AND: [
            ...(notification.visibility ? [passesVisibilityWhere(notification.visibility)] : []),
            ...(notification.canRegisterForEvent ? [whoCanRegisterWhere(notification.canRegisterForEvent)] : []),
            ...(notification.registeredForEvent ? [registeredForEventWhere(notification.registeredForEvent.id)] : []),
            ...(permission && !defaultPermissions.includes(permission) ? [{
                memberships: {
                    some: {
                        active: true,
                        group: { permissions: { some: { permission } } },
                    },
                },
            }] : []),
        ],
    }
}

/** The users registered for the event, on a place or waiting for one. */
function registeredForEventWhere(eventId: number): Prisma.UserWhereInput {
    return {
        EventRegistration: {
            some: {
                OR: [{ quota: { variant: { eventId } } }, { waitingListVariant: { eventId } }],
            },
        },
    }
}

/** The channel and the channels above it, nearest first, as recipientsWhere takes them. */
export async function readChannelChainIds(prisma: PrismaPossibleTransaction<false>, channelId: number): Promise<number[]> {
    const channels = await prisma.notificationChannel.findMany({ select: { id: true, parentId: true } })
    return findChainIds(channelId, channelsById(channels))
}

/**
 * Subscribed to the channel with the method on, as the user's rows resolve: their row for the
 * channel decides when they have one, else their row for the channel above, and so on up to
 * ROOT. The same rule as resolveSubscriptions, as a filter.
 */
function subscribedWhere([channelId, ...ancestorIds]: number[], method: NotificationMethods): Prisma.UserWhereInput {
    if (channelId === undefined) return { id: { in: [] } }
    const own = { notificationSubscriptions: { some: { channelId, methods: { [method]: true } } } }
    if (ancestorIds.length === 0) return own
    return {
        OR: [
            own,
            { AND: [{ notificationSubscriptions: { none: { channelId } } }, subscribedWhere(ancestorIds, method)] },
        ],
    }
}
