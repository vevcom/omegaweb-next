import NotificationForm from './NotificationForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { dynamicNotificationOperations } from '@/services/notifications/dynamic/operations'
import { dynamicNotificationAuth } from '@/services/notifications/dynamic/auth'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('send-notification', session)
        return dynamicNotificationOperations.readManyChannels({})
    },
    capabilities: () => ({
        canCreateNotification: dynamicNotificationAuth.createNotification,
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
