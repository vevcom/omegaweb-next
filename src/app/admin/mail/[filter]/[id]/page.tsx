import MailFlow from './MailFlow'
import styles from './page.module.scss'
import EditMailAlias from './(editComponents)/mailAlias'
import EditMailingList from './(editComponents)/mailingList'
import EditMailAddressExternal from './(editComponents)/mailAddressExternal'
import EditUser from './(editComponents)/user'
import EditGroup from './(editComponents)/group'
import { mailOperations } from '@/services/mail/operations'
import { MailListTypeArray } from '@/services/mail/types'
import { readExpandedOfAllTypes } from '@/services/groups/readExpandedOfAllTypes'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserSelectionProvider from '@/contexts/UserSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { serverPage } from '@/app/serverPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'
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
            <div className={styles.wrapper}>
                <p className={styles.typeTag}>{typeDisplayNames[filter]}</p>

                <MailFlow filter={filter} id={id} data={results} groupNames={groupNames} />

                <div className={styles.editContainer}>
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
