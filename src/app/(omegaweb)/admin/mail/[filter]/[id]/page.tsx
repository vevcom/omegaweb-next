import MailFlow from './MailFlow'
import EditMailAlias from './(edit-components)/EditMailAlias'
import EditMailingList from './(edit-components)/EditMailingList'
import EditMailAddressExternal from './(edit-components)/EditMailAddressExternal'
import EditUser from './(edit-components)/EditUser'
import EditGroup from './(edit-components)/EditGroup'
import { mailOperations } from '@/services/mail/operations'
import { MailListTypeArray } from '@/services/mail/constants'
import { readExpandedOfAllTypes } from '@/services/groups/readExpandedOfAllTypes'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserSelectionProvider from '@/contexts/UserSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { MailFlowObject, MailListTypes } from '@/services/mail/types'

const typeDisplayNames: Record<MailListTypes, string> = {
    alias: 'E-postalias',
    mailingList: 'E-postliste',
    group: 'Gruppe',
    user: 'Bruker',
    mailaddressExternal: 'Ekstern e-postadresse',
}

function focusedLabel(filter: MailListTypes, id: number, data: MailFlowObject, groupNames: Record<number, string>) {
    if (filter === 'alias') return data.alias.find(alias => alias.id === id)?.address
    if (filter === 'mailingList') return data.mailingList.find(list => list.id === id)?.name
    if (filter === 'mailaddressExternal') return data.mailaddressExternal.find(external => external.id === id)?.address
    if (filter === 'group') return groupNames[id]
    const user = data.user.find(focusedUser => focusedUser.id === id)
    return user && `${user.firstname} ${user.lastname}`
}

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ filter: string, id: string }>) => {
        if (!MailListTypeArray.includes(params.filter as MailListTypes)) {
            notFound()
        }
        const filter = params.filter as MailListTypes

        const id = Number(params.id)
        if (!id || id <= 0) {
            notFound()
        }

        const [results, mailOptions, allGroupTypes] = await Promise.all([
            mailOperations.readMailTraversal({ params: { filter, id } }),
            mailOperations.readMailOptions({}),
            readExpandedOfAllTypes({}),
        ])

        const groups = flattenExpandedGroups(allGroupTypes)
        const groupNames: Record<number, string> = Object.fromEntries(groups.map(group => [group.id, group.name]))

        return { filter, id, results, mailOptions, groups, groupNames }
    },
    metadata: ({ filter, id, results, groupNames }) => ({
        title: focusedLabel(filter, id, results, groupNames) ?? typeDisplayNames[filter],
    }),
    render: ({ data }) => {
        const { filter, id, results, mailOptions, groups, groupNames } = data

        return <PageWrapper>
            <div className="p-4 flex flex-col gap-4">
                <p className="m-0 text-text-muted text-[0.85rem] uppercase tracking-[0.06em]">{typeDisplayNames[filter]}</p>

                <MailFlow filter={filter} id={id} data={results} groupNames={groupNames} />

                <div className="flex flex-row flex-wrap items-start gap-4">
                    {filter === 'mailingList' && <UserSelectionProvider>
                        <UserPagingProvider
                            startPage={{ page: 0, pageSize: 50 }}
                            serverRenderedData={[]}
                            details={{ partOfName: '', groups: [] }}
                        >
                            <EditMailingList
                                id={id}
                                data={results}
                                mailaliases={mailOptions.alias}
                                mailAddressExternal={mailOptions.mailaddressExternal}
                                groups={groups}
                            />
                        </UserPagingProvider>
                    </UserSelectionProvider>}
                    {filter === 'alias' && <EditMailAlias
                        id={id}
                        data={results}
                        mailingLists={mailOptions.mailingList}
                    />}
                    {filter === 'mailaddressExternal' && <EditMailAddressExternal
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

export default page
export { generateMetadata }
