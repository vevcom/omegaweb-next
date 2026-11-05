import UpdateNotificationSubscription, { treeConnectorClassName } from './UpdateNotificationSubscription'
import { countChildren } from '@/services/notifications/channels/subservice/helpers'
import type { SubscribableChannel } from './UpdateNotificationSubscription'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'
import type { MinimizedSubscription } from '@/services/notifications/subscription/types'
import type { CSSProperties, ReactNode } from 'react'

type TreeChannel = SubscribableChannel & Pick<ExpandedNotificationChannel, 'parentId' | '_count'>

/**
 * The user's subscriptions to the channels given, as the tree their parents make. A channel whose
 * parent is not among them, or is itself, tops a tree. Each row saves on its own, for the channel
 * or for everything under it too, which includes channels the tree does not show: those are marked.
 */
export default function NotificationSubscriptionTree({
    userId,
    channels,
    subscriptions,
}: {
    userId: number,
    channels: TreeChannel[],
    subscriptions: MinimizedSubscription[],
}) {
    const ids = new Set(channels.map(channel => channel.id))
    const childrenOf = (channel: TreeChannel) => channels.filter(
        candidate => candidate.parentId === channel.id && candidate.id !== channel.id
    )
    const rows = (channel: TreeChannel, depth: number): ReactNode[] => {
        const shown = childrenOf(channel)
        const hidden = countChildren(channel) - shown.length
        return [
            <UpdateNotificationSubscription
                key={channel.id}
                userId={userId}
                channel={channel}
                methods={subscriptions.find(subscription => subscription.channelId === channel.id)?.methods ?? null}
                hasChildren={countChildren(channel) > 0}
                depth={depth}
            />,
            ...shown.flatMap(child => rows(child, depth + 1)),
            ...(hidden > 0 ? [
                <p
                    key={`${channel.id}-hidden`}
                    className="m-0 py-3 pl-[calc(var(--depth)*1.5rem)] text-s text-text-muted"
                    style={{ '--depth': depth + 1 } as CSSProperties}
                >
                    <span className={treeConnectorClassName} aria-hidden="true" />
                    … {hidden} {hidden === 1 ? 'kanal' : 'kanaler'} til, som ikke vises her
                </p>,
            ] : []),
        ]
    }

    return <div className="flex flex-col divide-y divide-surface-hover">
        {channels
            .filter(channel => channel.parentId === channel.id || !ids.has(channel.parentId))
            .flatMap(channel => rows(channel, 0))}
    </div>
}
