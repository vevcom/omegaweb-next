import MailForm from './MailForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import SiteLink from '@/components/SiteLink/SiteLink'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { appHref } from '@/lib/sites/href'
import { serverPage, withFallback } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session, searchParams }: PageOperationArgs) => {
        await authorizeAdminPage('send-mail', session)
        // The aliases the session reads, marked with the ones it owns: a sender sends from those, and a
        // mail server administrator from them all, as sendMailFromAlias has it.
        const aliases = await withFallback(
            aliasOperations.readMany({ params: { markOwnedByUserId: session.user?.id } }),
            [],
        )
        const sendsFromAny = session.permissions.includes('MAILSERVER_ADMIN')
        const mailingLists = await withFallback(mailingListOperations.readMany({ params: {} }), [])
        const fromAliasId = Number(searchParams.from) || null
        return { aliases: aliases.filter(alias => sendsFromAny || alias.owned), mailingLists, fromAliasId }
    },
    metadata: () => ({ title: 'E-postutsendelse' }),
    render: ({ data }) => (
        <PageWrapper>
            <p className="text-base-content/80 max-w-[70ch]">
                Skal du nå medlemmer av Omega?{' '}
                <SiteLink href={appHref('/admin/send-notification')}>Send et varsel</SiteLink> i stedet.
                Det når dem slik de selv har valgt, på e-post, som push eller bare på veven, og trenger ingen
                avsenderadresse. E-post er for mottakere utenfor veven og for lister med eksterne adresser.
            </p>
            <MailForm
                aliases={data.aliases}
                mailingLists={data.mailingLists}
                fromAliasId={data.fromAliasId}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
