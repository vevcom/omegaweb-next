import MailForm from './MailForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { sendMailAuth } from '@/services/notifications/sendMail/auth'
import { mailingListOperations } from '@/services/mail/list/operations'
import { serverPage, withFallback } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('send-mail', session)
        // Sending only takes MAIL_USE, so a sender who may not read the lists just gets none to pick.
        return withFallback(mailingListOperations.readMany({}), [])
    },
    capabilities: () => ({
        canSendMail: sendMailAuth.sendMail,
    }),
    metadata: () => ({ title: 'Elektronisk postutsendelse' }),
    render: ({ data: mailingLists, capabilities }) => (
        <PageWrapper>
            {capabilities.canSendMail.authorized && <MailForm mailingLists={mailingLists} />}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
