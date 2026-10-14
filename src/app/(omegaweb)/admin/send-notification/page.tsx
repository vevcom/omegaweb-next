import NotificationForm from './NotificationForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { notificationAuth } from '@/services/notifications/auth'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('send-notification', session)
        return notificationChannelOperations.readMany({})
    },
    capabilities: () => ({
        canCreateNotification: notificationAuth.create,
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
