import styles from './page.module.scss'
import AddNotificationChannel from './addNotificationChannel'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Link from 'next/link'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'
import type { PageOperationArgs } from '@/app/serverPage'

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
    metadata: () => ({ title: 'Varslingskanaler' }),
    render: ({ data: channels }) => {
        const rows = orderByHierarchy(channels)

        return (
            <PageWrapper
                headerItem={
                    <AddHeaderItemPopUp popUpKey="CreateNotificationChannel">
                        <AddNotificationChannel channels={channels}/>
                    </AddHeaderItemPopUp>
                }
            >
                <table className={styles.channelList}>
                    <thead>
                        <tr>
                            <th>Navn</th>
                            <th>Beskrivelse</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ channel, depth }) => (
                            <Link key={channel.id} href={`/admin/notification-channels/${channel.id}`}>
                                <tr>
                                    <td>
                                        <span className={styles.name} style={{ paddingLeft: `${depth * 1.5}rem` }}>
                                            {depth > 0 ? <span className={styles.branch} aria-hidden="true" /> : null}
                                            {channel.name}
                                        </span>
                                        {channel.special
                                            ? <span className={styles.badge}>{channel.special}</span>
                                            : null}
                                    </td>
                                    <td className={styles.description}>{channel.description || '—'}</td>
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
