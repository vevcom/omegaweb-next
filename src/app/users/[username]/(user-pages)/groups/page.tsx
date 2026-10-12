import styles from './page.module.scss'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import SimpleTable from '@/components/Table/SimpleTable'
import { groupTypesConfig } from '@/services/groups/constants'
import { omegaMembershipGroupAuth } from '@/services/groups/omegaMembershipGroups/auth'
import { classAuth } from '@/services/groups/classes/auth'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import { committeeAuth } from '@/services/groups/committees/auth'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import { manualGroupAuth } from '@/services/groups/manualGroups/auth'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import { classOperations } from '@/services/groups/classes/operations'
import { studyProgrammeOperations } from '@/services/groups/studyProgrammes/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { interestGroupOperations } from '@/services/groups/interestGroups/operations'
import { manualGroupOperations } from '@/services/groups/manualGroups/operations'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

// Each group type guards the memberships in it on its own, so the page shows the types the
// session may read and leaves the rest out.
const groupTypes = [
    {
        type: 'OMEGA_MEMBERSHIP_GROUP',
        authorizer: omegaMembershipGroupAuth.readMembershipsOfUser,
        readMemberships: omegaMembershipGroupOperations.readMembershipsOfUser,
    },
    {
        type: 'CLASS',
        authorizer: classAuth.readMembershipsOfUser,
        readMemberships: classOperations.readMembershipsOfUser,
    },
    {
        type: 'STUDY_PROGRAMME',
        authorizer: studyProgrammeAuth.readMembershipsOfUser,
        readMemberships: studyProgrammeOperations.readMembershipsOfUser,
    },
    {
        type: 'COMMITTEE',
        authorizer: committeeAuth.readMembershipsOfUser,
        readMemberships: committeeOperations.readMembershipsOfUser,
    },
    {
        type: 'INTEREST_GROUP',
        authorizer: interestGroupAuth.readMembershipsOfUser,
        readMemberships: interestGroupOperations.readMembershipsOfUser,
    },
    {
        type: 'MANUAL_GROUP',
        authorizer: manualGroupAuth.readMembershipsOfUser,
        readMemberships: manualGroupOperations.readMembershipsOfUser,
    },
] as const

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'groups', session)
        const userId = profile.user.id

        return Promise.all(groupTypes
            .filter(({ authorizer }) => authorizer.data({ userId }).auth(session).authorized)
            .map(async ({ type, readMemberships }) => ({
                type,
                memberships: await readMemberships({ params: { userId } }),
            })))
    },
    render: ({ data: sections }) => (
        <div className={styles.wrapper}>
            <h2>Grupper</h2>
            {sections.map(({ type, memberships }) =>
                <section key={type} className={styles.groupType}>
                    <h3>{groupTypesConfig[type].namePlural}</h3>
                    {memberships.length === 0 ? (
                        <p className={styles.empty}>Ingen medlemskap.</p>
                    ) : (
                        <SimpleTable
                            header={['Gruppe', 'Tittel', 'Orden', 'Status', 'Admin']}
                            body={memberships.map(membership => [
                                membership.groupName,
                                membership.title,
                                membership.order,
                                membership.active ? 'Aktiv' : 'Inaktiv',
                                membership.admin ? 'Ja' : 'Nei',
                            ])}
                        />
                    )}
                </section>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }
