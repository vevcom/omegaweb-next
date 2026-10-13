import ChannelSettings from './ChannelSettings'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { notificationChannelAuth } from '@/services/notifications/channel/auth'
import { aliasOperations } from '@/services/mail/alias/operations'
import { serverPage } from '@/app/serverPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ currentId: string }>) => {
        const [channels, mailAliases] = await Promise.all([
            notificationChannelOperations.readMany({}),
            aliasOperations.readMany({}),
        ])

        const currentId = Number(params.currentId)
        const selected = channels.find(channel => channel.id === currentId)

        if (!selected) {
            notFound()
        }

        return { channels, mailAliases, selected }
    },
    capabilities: () => ({
        canUpdateChannel: notificationChannelAuth.update,
    }),
    metadata: (data) => ({ title: data.selected.name }),
    render: ({ data, capabilities }) => (
        <ChannelSettings
            channels={data.channels}
            currentChannel={data.selected}
            mailAliases={data.mailAliases}
            capabilities={{ canUpdate: capabilities.canUpdateChannel.toJsObject() }}
        />
    ),
})

export default page
export { generateMetadata }
