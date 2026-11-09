import NotificationForm from './NotificationForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'
import { manualNotificationChannelAuth } from '@/services/notifications/channels/manual/auth'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await authorizeAdminPage('send-notification', session)
        return manualNotificationChannelOperations.readMany({})
    },
    capabilities: () => ({
        canCreateNotification: manualNotificationChannelAuth.createNotification,
    }),
    metadata: () => ({ title: 'Send varsel' }),
    render: ({ data: channels, capabilities }) => (
        <PageWrapper>
            {capabilities.canCreateNotification.authorized && <NotificationForm channels={channels}/>}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
