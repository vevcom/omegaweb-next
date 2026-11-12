import MailFlow from '@/pageKits/mailServer/components/MailFlow'
import EditMailAlias from '@/pageKits/mailServer/components/EditMailAlias'
import EditMailingList from '@/pageKits/mailServer/components/EditMailingList'
import EditMailAddressExternal from '@/pageKits/mailServer/components/EditMailAddressExternal'
import EditUser from '@/pageKits/mailServer/components/EditUser'
import EditGroup from '@/pageKits/mailServer/components/EditGroup'
import MailServerTabs from '@/pageKits/mailServer/components/MailServerTabs'
import { mailServerPartArray } from '@/pageKits/mailServer/links'
import { mailOperations, mailTraversalReadOfType } from '@/services/mail/operations'
import { aliasMailAddressOperations, aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { MailListTypeArray, validMailAddressDomains } from '@/services/mail/constants'
import { mailboxesAreAvailable } from '@/lib/mailServerSync/constants'
import { readExpandedOfAllTypes } from '@/services/groups/readExpandedOfAllTypes'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserSelectionProvider from '@/contexts/UserSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { MailServerPart } from '@/pageKits/mailServer/links'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { MailFlowObject, MailListTypes } from '@/services/mail/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

const typeDisplayNames: Record<MailListTypes, string> = {
    alias: 'E-postalias',
    mailingList: 'E-postliste',
    group: 'Gruppe',
    user: 'Bruker',
    mailaddressExternal: 'Ekstern e-postadresse',
}

function focusedLabel(filter: MailListTypes, id: number, data: MailFlowObject) {
    if (filter === 'alias') return data.alias.find(alias => alias.id === id)?.address
    if (filter === 'mailingList') return data.mailingList.find(list => list.id === id)?.name
    if (filter === 'mailaddressExternal') return data.mailaddressExternal.find(external => external.id === id)?.address
    if (filter === 'group') return data.group.find(group => group.id === id)?.name
    const user = data.user.find(focusedUser => focusedUser.id === id)
    return user && `${user.firstname} ${user.lastname}`
}

/** Aliases and mailing lists have owners; the matrix is empty for the other nodes, which have no owners to edit. */
function readOwners(filter: MailListTypes, id: number): Promise<VisibilityMatrix> {
    if (filter === 'alias') return aliasOperations.visibility.readMatrix({ params: { id } })
    if (filter === 'mailingList') return mailingListOperations.visibility.readMatrix({ params: { id } })
    return Promise.resolve({ requirements: [] })
}

/** A group or a user is in the flow without a part of its own, so no tab is active on its page. */
function partOf(filter: MailListTypes): MailServerPart | null {
    return mailServerPartArray.includes(filter as MailServerPart) ? filter as MailServerPart : null
}

/** One node of the mail flow: how mail reaches it and where it goes on, and the forms changing that. */
export const mailServerNodePage = (config: MailServerPagesConfig) => serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ filter: string, id: string }>) => {
        if (!MailListTypeArray.includes(params.filter as MailListTypes)) {
            notFound()
        }
        const filter = params.filter as MailListTypes

        const id = Number(params.id)
        if (!id || id <= 0) {
            notFound()
        }

        const [results, mailOptions, allGroupTypes, owners, mailAddress] = await Promise.all([
            mailTraversalReadOfType[filter]({ params: { id, markOwnedByUserId: session.user?.id } }),
            mailOperations.readMailOptions({}),
            readExpandedOfAllTypes({}),
            readOwners(filter, id),
            filter === 'alias' ? aliasMailAddressOperations.read({ params: { id } }) : null,
        ])

        const groups = flattenExpandedGroups(allGroupTypes)
        const domains = filter === 'alias' ? validMailAddressDomains() : []

        return { filter, id, results, mailOptions, groups, domains, owners, mailAddress }
    },
    metadata: ({ filter, id, results }) => ({
        title: focusedLabel(filter, id, results) ?? typeDisplayNames[filter],
    }),
    render: ({ data }) => {
        const { filter, id, results, mailOptions, groups, domains, owners, mailAddress } = data

        return <PageWrapper>
            <div className="p-4 flex flex-col gap-4">
                <MailServerTabs config={config} active={partOf(filter)} />
                <p className="m-0 text-base-content/80 text-[0.85rem] uppercase tracking-[0.06em]">
                    {typeDisplayNames[filter]}
                </p>

                <MailFlow config={config} filter={filter} id={id} data={results} />

                <div className="flex flex-row flex-wrap items-start gap-4">
                    {filter === 'mailingList' && <UserSelectionProvider>
                        <UserPagingProvider
                            startPage={{ page: 0, pageSize: 50 }}
                            serverRenderedData={[]}
                            details={{ partOfName: '', groups: [] }}
                        >
                            <EditMailingList
                                config={config}
                                id={id}
                                data={results}
                                mailaliases={mailOptions.alias}
                                mailAddressExternal={mailOptions.mailaddressExternal}
                                groups={groups}
                                owners={owners}
                            />
                        </UserPagingProvider>
                    </UserSelectionProvider>}
                    {filter === 'alias' && mailAddress && <EditMailAlias
                        config={config}
                        id={id}
                        data={results}
                        mailAddress={mailAddress}
                        mailingLists={mailOptions.mailingList}
                        domains={domains}
                        owners={owners}
                        mailboxes={mailboxesAreAvailable}
                    />}
                    {filter === 'mailaddressExternal' && <EditMailAddressExternal
                        config={config}
                        id={id}
                        data={results}
                        mailingLists={mailOptions.mailingList}
                    />}
                    {filter === 'user' && <EditUser
                        id={id}
                        data={results}
                        mailingLists={mailOptions.mailingList}
                    />}
                    {filter === 'group' && <EditGroup
                        id={id}
                        data={results}
                        mailingLists={mailOptions.mailingList}
                    />}
                </div>
            </div>
        </PageWrapper>
    },
})
