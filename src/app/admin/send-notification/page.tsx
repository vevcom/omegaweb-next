import NotificationForm from './notificationForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('send-notification', session)
        return notificationChannelOperations.readMany({})
    },
    metadata: () => ({ title: 'Send varsel' }),
    render: ({ data: channels }) => (
        <PageWrapper>
            <NotificationForm channels={channels}/>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
