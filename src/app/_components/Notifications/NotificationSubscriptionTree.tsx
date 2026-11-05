import UpdateNotificationSubscription from './UpdateNotificationSubscription'
import { treeConnectorClassName } from './constants'
import { countChildren } from '@/services/notifications/channels/subservice/helpers'
import type { SubscribableChannel } from './UpdateNotificationSubscription'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'
import type { MinimizedSubscription } from '@/services/notifications/subscription/types'
import type { ReactNode } from 'react'

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
    const node = (channel: TreeChannel, depth: number): ReactNode => {
        const shown = childrenOf(channel)
        const hidden = countChildren(channel) - shown.length
        return <div key={channel.id} className="flex flex-col">
            <div className="border-b border-surface-hover">
                <UpdateNotificationSubscription
                    userId={userId}
                    channel={channel}
                    methods={subscriptions.find(subscription => subscription.channelId === channel.id)?.methods ?? null}
                    hasChildren={countChildren(channel) > 0}
                    depth={depth}
                />
            </div>
            {(shown.length > 0 || hidden > 0) && (
                <div className="flex flex-col ml-6 pl-6 border-l-[3px] border-text-muted/40 rounded-bl-inner">
                    {shown.map(child => node(child, depth + 1))}
                    {hidden > 0 && (
                        <p className="m-0 py-3 text-s text-text-muted">
                            <span className={treeConnectorClassName} aria-hidden="true" />
                            … {hidden} {hidden === 1 ? 'kanal' : 'kanaler'} til, som ikke vises her
                        </p>
                    )}
                </div>
            )}
        </div>
    }

    return <div className="flex flex-col">
        {channels
            .filter(channel => channel.parentId === channel.id || !ids.has(channel.parentId))
            .map(channel => node(channel, 0))}
    </div>
}
