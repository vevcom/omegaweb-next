import ChannelSettings from './ChannelSettings'
import SpecialChannelInfo from './SpecialChannelInfo'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'
import { specialNotificationChannelOperations } from '@/services/notifications/channels/special/operations'
import { manualNotificationChannelAuth } from '@/services/notifications/channels/manual/auth'
import { aliasOperations } from '@/services/mail/alias/operations'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ currentId: string }>) => {
        authorizeAdminPage('notification-channels', session)

        const [special, manual, mailAliases] = await Promise.all([
            specialNotificationChannelOperations.readMany({}),
            manualNotificationChannelOperations.readMany({}),
            aliasOperations.readMany({ params: {} }),
        ])
        const channels = [...special, ...manual]

        const currentId = Number(params.currentId)
        const selected = channels.find(channel => channel.id === currentId)

        if (!selected) {
            notFound()
        }

        return { channels, mailAliases, selected }
    },
    capabilities: () => ({
        canUpdateChannel: manualNotificationChannelAuth.update,
        canDestroyChannel: manualNotificationChannelAuth.destroy,
    }),
    metadata: (data) => ({ title: data.selected.name }),
    render: ({ data, capabilities }) => (data.selected.special ? (
        <SpecialChannelInfo channel={data.selected} />
    ) : (
        <ChannelSettings
            channels={data.channels}
            currentChannel={data.selected}
            mailAliases={data.mailAliases}
            capabilities={{
                canUpdate: capabilities.canUpdateChannel.toJsObject(),
                canDestroy: capabilities.canDestroyChannel.toJsObject(),
            }}
        />
    )),
})

export default page
export { generateMetadata }
