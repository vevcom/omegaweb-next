import styles from './page.module.scss'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { OmegaMembershipLevelConfig } from '@/services/groups/constants'
import { serverPage } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import GroupTypeTable from '@/components/Group/GroupTypeTable'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('omega-membership-groups', session)
        const [membershipGroups, expandedGroups, currentOrder] = await Promise.all([
            omegaMembershipGroupOperations.readMany({}),
            omegaMembershipGroupOperations.readExpanded({}),
            omegaOrderOperations.readCurrent({}),
        ])
        return { membershipGroups, expandedGroups, currentOrder }
    },
    metadata: () => ({ title: 'Medlemsgrupper' }),
    render: ({ data }) => {
        // Membership in these groups is only ever changed through the admission system, so every row
        // points there rather than at a page of its own.
        const rows = data.membershipGroups.flatMap(membershipGroup => {
            const expanded = data.expandedGroups.find(group => group.id === membershipGroup.groupId)
            return expanded ? [{
                key: membershipGroup.id,
                name: OmegaMembershipLevelConfig[membershipGroup.omegaMembershipLevel].name,
                order: expanded.order,
                members: expanded.members,
                href: '/admin/admission',
            }] : []
        })

        return (
            <PageWrapper>
                <p className={styles.explanation}>
                    Hvilken medlemsgruppe en bruker tilhører styres kun gjennom opptakssystemet. Gruppene
                    følger ordenen til Omega automatisk, og kan verken opprettes eller slettes.
                </p>
                <GroupTypeTable rows={rows} currentOrder={data.currentOrder.order} nameHeading="Medlemsgruppe" />
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
