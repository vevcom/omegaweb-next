import AddNotificationChannel from './AddNotificationChannel'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { notificationChannelAuth } from '@/services/notifications/channel/auth'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import Link from 'next/link'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'
import type { PageOperationArgs } from '@/app/ServerPage'

type ChannelRow = {
    channel: ExpandedNotificationChannel,
    depth: number,
}

/**
 * Flattens the channel tree (rooted at the special ROOT channel) into a depth-first,
 * alphabetically-sorted list so it can be rendered as an indented table.
 */
function orderByHierarchy(channels: ExpandedNotificationChannel[]): ChannelRow[] {
    const root = channels.find(channel => channel.special === 'ROOT')
    const rows: ChannelRow[] = []
    const visited = new Set<number>()

    function visit(channel: ExpandedNotificationChannel, depth: number) {
        visited.add(channel.id)
        rows.push({ channel, depth })

        channels
            .filter(candidate => candidate.parentId === channel.id && !visited.has(candidate.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(child => visit(child, depth + 1))
    }

    if (root) visit(root, 0)

    // Anything not reachable from ROOT shouldn't normally happen, but is still shown so nothing is hidden.
    channels
        .filter(channel => !visited.has(channel.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(channel => rows.push({ channel, depth: 0 }))

    return rows
}

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('notification-channels', session)
        return notificationChannelOperations.readMany({})
    },
    capabilities: () => ({
        canCreateChannel: notificationChannelAuth.create,
    }),
    metadata: () => ({ title: 'Varslingskanaler' }),
    render: ({ data: channels, capabilities }) => {
        const rows = orderByHierarchy(channels)

        return (
            <PageWrapper
                headerItem={capabilities.canCreateChannel.authorized &&
                    <AddHeaderItemPopUp popUpKey="CreateNotificationChannel">
                        <AddNotificationChannel channels={channels}/>
                    </AddHeaderItemPopUp>
                }
            >
                <table className="ohma-table">
                    <thead>
                        <tr>
                            <th>Navn</th>
                            <th>Beskrivelse</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ channel, depth }) => (
                            <Link
                                key={channel.id}
                                href={`/admin/notification-channels/${channel.id}`}
                                className="contents no-underline text-inherit"
                            >
                                <tr>
                                    <td>
                                        <span
                                            className="inline-flex items-center"
                                            style={{ paddingLeft: `${depth * 1.5}rem` }}
                                        >
                                            {depth > 0 ? <span
                                                className="
                                                    inline-block size-[0.6em] mr-[0.6em] border-l-2 border-b-2
                                                    border-text-muted
                                                "
                                                aria-hidden="true"
                                            /> : null}
                                            {channel.name}
                                        </span>
                                        {channel.special
                                            ? <span
                                                className="
                                                    ml-[0.6em] py-[0.1em] px-[0.6em] rounded-full
                                                    bg-[color-mix(in_srgb,var(--accent-blue),transparent_80%)]
                                                    text-accent-blue text-s font-medium uppercase tracking-[0.03em]
                                                    whitespace-nowrap
                                                "
                                            >
                                                {channel.special}
                                            </span>
                                            : null}
                                    </td>
                                    <td className="text-text-muted">{channel.description || '—'}</td>
                                </tr>
                            </Link>
                        ))}
                    </tbody>
                </table>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
