import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { aliasOperations } from '@/services/mail/alias/operations'
import { validMailAddressDomains } from '@/services/mail/constants'
import { vevenMailAddressOperations } from '@/services/users/vevenMailAddress'
import { userAuth } from '@/services/users/auth'
import { updateVevenMailAddressAction, updateVevenMailAddressForwardingAction } from '@/services/users/actions'
import { configureAction } from '@/services/configureAction'
import { mailServerIsManaged, mailServerWebmail, mailboxesAreAvailable } from '@/lib/mailServerSync/constants'
import MailAddressForm from '@/components/Mail/MailAddressForm'
import MailForwardingForm from '@/components/Mail/MailForwardingForm'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverPage, withFallback } from '@/app/ServerPage'
import { externalHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * The mail of a user on our domains. Their own address, whose mail is in their mailbox in the
 * webmail and is sent on to their private email while they have that on: the address is changed
 * by a user admin, and the forwarding by the user. And the aliases they receive mail on, through
 * the mailing lists they and their groups are on, each with a mailbox they read and answer from as
 * the alias. The webmail signs them in with the account they have here and shows them their own
 * mailbox and those of their aliases alone.
 *
 * The aliases are the user's own to see, so a user admin who is here to change the address sees
 * the address alone.
 */
const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'mail', session)
        const userId = profile.user.id
        const [aliases, vevenMailAddress] = await Promise.all([
            withFallback(aliasOperations.readReceived({ params: { userId } }), null, ['UNAUTHORIZED']),
            vevenMailAddressOperations.read({ params: { userId } }),
        ])
        return {
            userId,
            email: profile.user.email,
            aliases,
            // An address is on the mail server once the server is managed, so it is not shown before.
            vevenMailAddress: mailServerIsManaged ? vevenMailAddress : null,
            domains: validMailAddressDomains(),
            webmail: mailboxesAreAvailable ? mailServerWebmail?.origin ?? null : null,
        }
    },
    capabilities: data => ({
        canUpdateVevenMailAddress: userAuth.updateVevenMailAddress,
        canUpdateForwarding: userAuth.updateVevenMailAddressForwarding.data({ userId: data.userId }),
    }),
    render: ({ data: { userId, email, aliases, vevenMailAddress, domains, webmail }, capabilities }) => (
        <div className="flex flex-col gap-4">
            {vevenMailAddress && <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                <h2 className="m-0">E-postadresse</h2>
                <div className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium">{vevenMailAddress.address}</span>
                    {webmail && <SiteLink href={externalHref(webmail)} target="_blank" className="ml-auto">
                        Åpne postkassen
                    </SiteLink>}
                </div>
                <p className="m-0">
                    {webmail
                        ? <>
                            E-post til adressen ligger i postkassen din i webmailen, med samme innlogging som
                            her, og du svarer fra adressen der.
                            {vevenMailAddress.forwardsToPrivateEmail
                                ? ` En kopi videresendes til ${email}.`
                                : ' Den videresendes ikke.'}
                        </>
                        : `E-post til adressen videresendes til ${email}.`}
                </p>
                {webmail && capabilities.canUpdateForwarding.authorized && <MailForwardingForm
                    action={configureAction(
                        configureAction(updateVevenMailAddressForwardingAction, { implementationParams: { userId } }),
                        { params: { mailAddressId: vevenMailAddress.id } },
                    )}
                    forwardsToPrivateEmail={vevenMailAddress.forwardsToPrivateEmail}
                >
                    <p className="m-0 text-base-content/80">
                        Med videresending får du også en kopi til {email}. Uten leser du e-posten bare i
                        postkassen.
                    </p>
                </MailForwardingForm>}
                {capabilities.canUpdateVevenMailAddress.authorized && <MailAddressForm
                    action={configureAction(
                        configureAction(updateVevenMailAddressAction, { implementationParams: { userId } }),
                        { params: { mailAddressId: vevenMailAddress.id } },
                    )}
                    address={vevenMailAddress.address}
                    domains={domains}
                />}
            </div>}

            {aliases && <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                <h2 className="m-0">Aliaser</h2>
                <p className="m-0">
                    E-post til disse aliasene når deg, gjennom e-postlistene du og gruppene dine står på.
                    {webmail && <>
                        {' '}Hvert alias har en postkasse du leser og svarer fra i{' '}
                        <SiteLink href={externalHref(webmail)} target="_blank">webmailen</SiteLink>,
                        ved siden av din egen.
                    </>}
                </p>
                {aliases.length === 0
                    ? <p className="m-0 text-base-content/80">Du mottar ikke e-post på noe alias.</p>
                    : <ul className="m-0 p-0 list-none flex flex-col gap-2">
                        {aliases.map(alias => (
                            <li key={alias.id} className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="font-medium">{alias.address}</span>
                                {alias.description && <span className="text-base-content/80">{alias.description}</span>}
                            </li>
                        ))}
                    </ul>
                }
            </div>}
        </div>
    ),
})

export default page
export { generateMetadata }
