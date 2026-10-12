import { interestGroupOperations } from '@/services/groups/interestGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { serverPage } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import GroupTypeTable from '@/components/Group/GroupTypeTable'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('interest-groups', session)
        const [interestGroups, expandedGroups, currentOrder] = await Promise.all([
            interestGroupOperations.readMany({}),
            interestGroupOperations.readExpanded({}),
            omegaOrderOperations.readCurrent({}),
        ])
        return { interestGroups, expandedGroups, currentOrder }
    },
    metadata: () => ({ title: 'Interessegrupper' }),
    render: ({ data }) => {
        const rows = data.interestGroups.flatMap(interestGroup => {
            const expanded = data.expandedGroups.find(group => group.id === interestGroup.groupId)
            return expanded ? [{
                key: interestGroup.id,
                name: interestGroup.name,
                order: expanded.order,
                members: expanded.members,
                pensioned: interestGroup.pensioned,
                href: `/interest-groups/${interestGroup.id}`,
            }] : []
        })

        return (
            <PageWrapper>
                <GroupTypeTable rows={rows} currentOrder={data.currentOrder.order} emptyText="Ingen interessegrupper" />
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
