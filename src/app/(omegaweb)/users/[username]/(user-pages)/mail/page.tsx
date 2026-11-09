import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailServerWebmail, mailboxesAreAvailable } from '@/services/mail/server/constants'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverPage } from '@/app/ServerPage'
import { externalHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * The aliases the user receives mail on, through the mailing lists they and their groups are on,
 * and a way into the webmail for those that keep a mailbox. The webmail signs them in with the
 * account they have here and shows them those mailboxes alone.
 */
const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'mail', session)
        const aliases = await aliasOperations.readReceived({ params: { userId: profile.user.id } })
        return { aliases, webmail: mailboxesAreAvailable ? mailServerWebmail?.origin ?? null : null }
    },
    render: ({ data: { aliases, webmail } }) => (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">E-post</h2>
            <p className="m-0">
                E-post til disse aliasene når deg, gjennom e-postlistene du og gruppene dine står på.
                {webmail && <>
                    {' '}De som har en postkasse, kan du også lese i{' '}
                    <SiteLink href={externalHref(webmail)} target="_blank">webmailen</SiteLink>,
                    med samme innlogging som her.
                </>}
            </p>
            {aliases.length === 0
                ? <p className="m-0 text-base-content/80">Du mottar ikke e-post på noe alias.</p>
                : <ul className="m-0 p-0 list-none flex flex-col gap-2">
                    {aliases.map(alias => (
                        <li key={alias.id} className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="font-medium">{alias.address}</span>
                            {alias.description && <span className="text-base-content/80">{alias.description}</span>}
                            {webmail && alias.hasMailbox && <SiteLink
                                href={externalHref(webmail)}
                                target="_blank"
                                className="ml-auto"
                            >
                                Åpne postkassen
                            </SiteLink>}
                        </li>
                    ))}
                </ul>
            }
        </div>
    ),
})

export default page
export { generateMetadata }
