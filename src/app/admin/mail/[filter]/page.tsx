import CreateMailAlias from '@/app/admin/mail/CreateMailAlias'
import CreateMailingList from '@/app/admin/mail/CreateMailingList'
import CreateMailaddressExternal from '@/app/admin/mail/CreateMailaddressExternal'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { mailingListAuth } from '@/services/mail/list/auth'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

/** The parts of the mail server that have their own admin page. */
const mailParts = {
    alias: {
        title: 'E-postalias',
        intro: 'Adressene det kan sendes e-post til. Et alias videresender alt det mottar til e-postlistene sine.',
        createAuth: () => mailAliasAuth.create,
    },
    mailingList: {
        title: 'E-postlister',
        intro: 'Bindeleddet i mailtjeneren. En e-postliste mottar e-post fra aliasene sine og'
            + ' videresender den til grupper, brukere og eksterne adresser.',
        createAuth: () => mailingListAuth.create,
    },
    mailaddressExternal: {
        title: 'Eksterne e-postadresser',
        intro: 'Mottakere utenfor nettsiden som kan settes på e-postlister.',
        createAuth: () => mailAddressExternalAuth.create,
    },
} as const

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ filter: string }>) => {
        if (!Object.keys(mailParts).includes(params.filter)) notFound()
        const filter = params.filter as keyof typeof mailParts

        // Each part has its own nav link, so each part page is guarded by exactly that link's
        // authorizers - the filter is validated above, so the nav entry always exists.
        authorizeAdminPage(`mail/${filter}`, session)

        const items = await (async () => {
            if (filter === 'alias') {
                const aliases = await aliasOperations.readMany({})
                return aliases.map(alias => ({ id: alias.id, label: alias.address, description: alias.description }))
            }
            if (filter === 'mailingList') {
                const lists = await mailingListOperations.readMany({})
                return lists.map(list => ({ id: list.id, label: list.name, description: list.description }))
            }
            const externals = await mailAddressExternalOperations.readMany({})
            return externals.map(external => (
                { id: external.id, label: external.address, description: external.description ?? '' }
            ))
        })()

        return { filter, items }
    },
    capabilities: ({ filter }) => ({
        canCreate: mailParts[filter].createAuth(),
    }),
    metadata: ({ filter }) => ({ title: mailParts[filter].title }),
    render: ({ data: { filter, items }, capabilities }) => <PageWrapper>
        <div className="p-4 flex flex-col gap-4">
            <p className="text-text-muted max-w-[60ch]">{mailParts[filter].intro}</p>
            <div className="flex flex-row flex-wrap gap-6 items-start">
                <ul className="flex-[1_1_300px] list-none p-0 m-0 flex flex-col gap-2 max-w-[40rem]">
                    {items.map(item => <li key={item.id}>
                        <Link href={`/admin/mail/${filter}/${item.id}`}
                            className="flex flex-col gap-1 p-4 rounded-round bg-surface-raised text-text no-underline transition-[background-color] duration-300 hover:bg-surface-hover [&_span]:text-text-muted [&_span]:text-[0.9rem]"
                        >
                            <strong>{item.label}</strong>
                            {item.description && <span>{item.description}</span>}
                        </Link>
                    </li>)}
                    {items.length === 0 && <li className="text-text-muted italic">Ingen enda.</li>}
                </ul>
                {capabilities.canCreate.authorized && <aside
                    className="flex-[0_1_20rem] bg-surface-raised rounded-[calc(3*var(--rounding))] p-(--card-padding)"
                >
                    {filter === 'alias' && <CreateMailAlias />}
                    {filter === 'mailingList' && <CreateMailingList />}
                    {filter === 'mailaddressExternal' && <CreateMailaddressExternal />}
                </aside>}
            </div>
        </div>
    </PageWrapper>,
})

export default page
export { generateMetadata }
