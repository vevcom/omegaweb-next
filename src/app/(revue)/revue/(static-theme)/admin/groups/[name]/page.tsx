import RevueGroupAdminForms from './RevueGroupAdminForms'
import ManageRevueSubGroupMembers from '@/app/(revue)/_components/ManageRevueSubGroupMembers'
import { groupMembersByOrder } from '@/components/Group/groupMembersByOrder'
import { revueAdminNavDef } from '@/app/(revue)/revue/(static-theme)/admin/revueAdminNavDef'
import { revueLinks } from '@/app/(revue)/links'
import { omegaLinks } from '@/app/(omegaweb)/links'
import MigrateGroup from '@/components/Group/MigrateGroup'
import PensionGroup from '@/components/Group/PensionGroup'
import SiteLink from '@/components/SiteLink/SiteLink'
import { groupTypesConfig } from '@/services/groups/constants'
import { migrateRevueSubGroupAction, pensionRevueSubGroupAction } from '@/services/groups/revueSubGroups/actions'
import { revueSubGroupAuth } from '@/services/groups/revueSubGroups/auth'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const sectionClassName = `
    flex flex-col gap-4 p-4 rounded-round bg-base-200
    [&>h2]:m-0 [&>h2]:text-l
`

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ name: string }>) => {
        await revueAdminNavDef.authorize('groups', session)
        const revueGroup = await revueGroupOperations.read({ params: { name: decodeURIComponent(params.name) } })
        const subGroup = revueGroup.revueSubGroup?.group
        const [members, currentOrder] = await Promise.all([
            subGroup ? revueSubGroupOperations.readMembers({ params: { groupId: subGroup.id } }) : [],
            omegaOrderOperations.readCurrent({}),
        ])
        return { revueGroup, subGroup, members, currentOrder: currentOrder.order }
    },
    capabilities: () => ({
        canMigrate: revueSubGroupAuth.migrateGroup,
        canPension: revueSubGroupAuth.pension,
    }),
    metadata: ({ revueGroup }) => ({ title: `Administrer ${revueGroup.name}` }),
    render: ({ data: { revueGroup, subGroup, members, currentOrder }, capabilities }) => (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
                <h1 className="m-0">{revueGroup.name}</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-base-content/80 text-s">
                    <span>{groupTypesConfig[revueGroup.type].name}</span>
                    {subGroup && <span>Orden {subGroup.order}{subGroup.pensioned && ', pensjonert'}</span>}
                    {revueGroup.committee && (
                        <SiteLink href={omegaLinks.committee(revueGroup.committee)} toMainDomainServingSite>
                            {revueGroup.committee.name} på Omegaveven
                        </SiteLink>
                    )}
                </div>
            </header>

            <section className={sectionClassName}>
                <h2>I revyene</h2>
                {revueGroup.revues.length === 0
                    ? <p className="m-0 text-base-content/80">
                        Gruppen er ikke med i noen revy. Den legges inn fra revyens side under Revyer.
                    </p>
                    : <ul className="m-0 p-0 list-none flex flex-col gap-1">
                        {revueGroup.revues.map(({ revue, order }) => (
                            <li key={revue.year}>
                                <SiteLink href={revueLinks.revueGroup(revue, revueGroup)}>{revue.name}</SiteLink>
                                <span className="text-base-content/80"> ({revue.year}), orden {order}</span>
                            </li>
                        ))}
                    </ul>}
            </section>

            {subGroup && !subGroup.pensioned && (
                <section className={sectionClassName}>
                    <h2>Medlemmer</h2>
                    <ManageRevueSubGroupMembers
                        groupId={subGroup.id}
                        groupOrder={subGroup.order}
                        orders={groupMembersByOrder(members, subGroup.order)}
                    />
                </section>
            )}

            {subGroup && !subGroup.pensioned && capabilities.canMigrate.authorized && (
                <section className={sectionClassName}>
                    <h2>Migrering</h2>
                    <MigrateGroup
                        groupId={subGroup.id}
                        groupOrder={subGroup.order}
                        currentOmegaOrder={currentOrder}
                        candidates={members
                            .filter(member => member.active && member.order === subGroup.order)
                            .map(member => ({
                                userId: member.userId,
                                name: `${member.user.firstname} ${member.user.lastname}`,
                                title: member.title,
                                admin: member.admin,
                            }))}
                        migrateGroupAction={migrateRevueSubGroupAction}
                    />
                </section>
            )}

            {subGroup && capabilities.canPension.authorized && (
                <section className={sectionClassName}>
                    <h2>Pensjonering</h2>
                    <PensionGroup
                        groupId={subGroup.id}
                        groupName={revueGroup.name}
                        pensioned={subGroup.pensioned}
                        currentOmegaOrder={currentOrder}
                        pensionGroupAction={pensionRevueSubGroupAction}
                    />
                </section>
            )}

            {!subGroup?.pensioned && (
                <section className={sectionClassName}>
                    <RevueGroupAdminForms group={revueGroup} />
                </section>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }
