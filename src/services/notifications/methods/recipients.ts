import { visibilityIncluder } from '@/services/visibility/implement'
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
} as const satisfies Prisma.NotificationInclude

export type DispatchableNotification = Prisma.NotificationGetPayload<{
    include: typeof notificationDispatchIncluder
}>

/**
 * The user filter for who receives a notification through the given method. It is evaluated when
 * the worker dispatches - not when the notification was created - so subscription, membership and
 * visibility changes in between count. A recipient must
 * 1. be subscribed to the notification's channel with the method enabled,
 * 2. be among the targeted users, when the notification targets anyone,
 * 3. pass the notification's visibility, when it has one. This mirrors checkVisibility
 *    (src/auth/visibility/checkVisibility.ts): every requirement needs some condition met, and
 * 4. hold the notification's permission, when it has one: as a default permission or through an
 *    active membership of a group holding it, as readPermissionsOfUser resolves permissions.
 */
export function recipientsWhere(
    notification: DispatchableNotification,
    method: NotificationMethods,
    defaultPermissions: Permission[],
): Prisma.UserWhereInput {
    const { permission } = notification
    return {
        notificationSubscriptions: {
            some: {
                channelId: notification.channelId,
                methods: {
                    [method]: true,
                },
            },
        },
        ...(notification.usersTargeted.length > 0 ? {
            id: {
                in: notification.usersTargeted.map(user => user.id),
            },
        } : {}),
        AND: [
            ...(notification.visibility?.requirements ?? []).map(requirement => ({
                memberships: {
                    some: {
                        OR: requirement.conditions.map(condition => (condition.type === 'ACTIVE' ? {
                            groupId: condition.groupId,
                            active: true,
                        } : {
                            groupId: condition.groupId,
                            order: condition.order,
                        })),
                    },
                },
            })),
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
