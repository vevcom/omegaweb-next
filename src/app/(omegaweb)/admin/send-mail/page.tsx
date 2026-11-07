import MailForm from './MailForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import SiteLink from '@/components/SiteLink/SiteLink'
import { sendMailAuth } from '@/services/notifications/sendMail/auth'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { appHref } from '@/lib/sites/href'
import { serverPage, withFallback } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session, searchParams }: PageOperationArgs) => {
        // The aliases the session reads are the ones it may send from. Owning one is enough to send
        // from it, so an owner opens the page without the permission that puts it in the nav.
        const aliases = await withFallback(aliasOperations.readMany({ params: {} }), [])
        if (aliases.length === 0) await authorizeAdminPage('send-mail', session)
        const mailingLists = await withFallback(mailingListOperations.readMany({ params: {} }), [])
        const fromAliasId = Number(searchParams.from) || null
        return { aliases, mailingLists, fromAliasId }
    },
    capabilities: () => ({
        canSendFromAnyAddress: sendMailAuth.sendMail,
    }),
    metadata: () => ({ title: 'E-postutsendelse' }),
    render: ({ data, capabilities }) => (
        <PageWrapper>
            <p className="text-text-muted max-w-[70ch]">
                Skal du nå medlemmer av Omega?{' '}
                <SiteLink href={appHref('/admin/send-notification')}>Send et varsel</SiteLink> i stedet.
                Det når dem slik de selv har valgt, på e-post, som push eller bare på veven, og trenger ingen
                avsenderadresse. E-post er for mottakere utenfor veven og for lister med eksterne adresser.
            </p>
            <MailForm
                aliases={data.aliases}
                mailingLists={data.mailingLists}
                fromAliasId={data.fromAliasId}
                capabilities={capabilitiesToJsObject(capabilities)}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
