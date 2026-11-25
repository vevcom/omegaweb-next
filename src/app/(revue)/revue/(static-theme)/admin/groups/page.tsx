import CreateRevueGroupForms from './CreateRevueGroupForms'
import { revueAdminLinks } from '@/app/(revue)/revue/(static-theme)/admin/links'
import { revueAdminNavDef } from '@/app/(revue)/revue/(static-theme)/admin/revueAdminNavDef'
import { omegaLinks } from '@/app/(omegaweb)/links'
import GroupTypeTable from '@/components/Group/GroupTypeTable'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import SiteLink from '@/components/SiteLink/SiteLink'
import { committeeOperations } from '@/services/groups/committees/operations'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const createPopUpKey = 'CreateRevueGroup'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await revueAdminNavDef.authorize('groups', session)
        const [revueGroups, subGroups, currentOrder, committees] = await Promise.all([
            revueGroupOperations.readMany({}),
            revueSubGroupOperations.readExpanded({}),
            omegaOrderOperations.readCurrent({}),
            withFallback(committeeOperations.readAll({}), null, ['UNAUTHENTICATED', 'UNAUTHORIZED']),
        ])
        return { revueGroups, subGroups, currentOrder, committees }
    },
    capabilities: () => ({
        canCreate: revueGroupAuth.create,
    }),
    metadata: () => ({ title: 'Grupper' }),
    render: ({ data: { revueGroups, subGroups, currentOrder, committees }, capabilities }) => {
        const subGroupRows = revueGroups.flatMap(revueGroup => {
            const subGroup = subGroups.find(group => group.id === revueGroup.revueSubGroup?.group.id)
            return subGroup ? [{
                key: revueGroup.id,
                name: revueGroup.name,
                order: subGroup.order,
                members: subGroup.members,
                pensioned: subGroup.pensioned,
                href: revueAdminLinks.group(revueGroup),
            }] : []
        })
        const committeeKinds = revueGroups.filter(revueGroup => revueGroup.committee)

        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                    <h1 className="m-0">Grupper</h1>
                    {capabilities.canCreate.authorized && <AddHeaderItemPopUp popUpKey={createPopUpKey}>
                        <CreateRevueGroupForms
                            committees={committees?.filter(committee => !revueGroups.some(
                                revueGroup => revueGroup.committee?.group.id === committee.groupId
                            )) ?? null}
                            closePopUpOnSuccess={createPopUpKey}
                        />
                    </AddHeaderItemPopUp>}
                </div>
                <p className="m-0 text-base-content/80">
                    En revygruppe er en revyundergruppe eller en komité. En ny gruppe er ikke med i noen revy før den
                    legges inn fra revyens side under Revyer.
                </p>
                <h2 className="m-0 mt-4">Revyundergrupper</h2>
                <GroupTypeTable
                    rows={subGroupRows}
                    currentOrder={currentOrder.order}
                    emptyText="Ingen revyundergrupper"
                />
                <h2 className="m-0 mt-4">Komitéer</h2>
                {committeeKinds.length === 0
                    ? <p className="m-0 text-base-content/80">Ingen komité er revygruppe ennå.</p>
                    : <ul className="m-0 p-0 list-none border-b border-base-300">
                        {committeeKinds.map(revueGroup => revueGroup.committee && (
                            <li key={revueGroup.id} className="
                                flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 border-t
                                border-base-300
                            ">
                                <SiteLink href={revueAdminLinks.group(revueGroup)} className="font-semibold">
                                    {revueGroup.name}
                                </SiteLink>
                                <SiteLink href={omegaLinks.committee(revueGroup.committee)} toMainDomainServingSite>
                                    {revueGroup.committee.name} på Omegaveven
                                </SiteLink>
                            </li>
                        ))}
                    </ul>}
            </div>
        )
    },
})

export default page
export { generateMetadata }
