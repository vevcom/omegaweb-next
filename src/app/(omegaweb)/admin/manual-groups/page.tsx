import ManualGroupForm from './ManualGroupForm'
import DestroyManualGroup from './DestroyManualGroup'
import { manualGroupOperations } from '@/services/groups/manualGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { manualGroupAuth } from '@/services/groups/manualGroups/auth'
import { serverPage } from '@/app/ServerPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import PopUp from '@/components/PopUp/PopUp'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('manual-groups', session)
        const [manualGroups, expandedGroups, currentOrder] = await Promise.all([
            manualGroupOperations.readMany({}),
            manualGroupOperations.readExpanded({}),
            omegaOrderOperations.readCurrent({}),
        ])
        return { manualGroups, expandedGroups, currentOrder }
    },
    capabilities: () => ({
        canCreateManualGroup: manualGroupAuth.create,
        canUpdateManualGroup: manualGroupAuth.update,
        canDestroyManualGroup: manualGroupAuth.destroy,
    }),
    metadata: () => ({ title: 'Andre grupper' }),
    render: ({ data, capabilities }) => {
        const membersOfGroup = (groupId: number) =>
            data.expandedGroups.find(group => group.id === groupId)?.members ?? 0
        const orderOfGroup = (groupId: number) =>
            data.expandedGroups.find(group => group.id === groupId)?.order ?? data.currentOrder.order

        return (
            <PageWrapper
                headerItem={capabilities.canCreateManualGroup.authorized && (
                    <AddHeaderItemPopUp popUpKey="create manual group">
                        <ManualGroupForm />
                    </AddHeaderItemPopUp>
                )}
            >
                <p className="text-text-muted max-w-[70ch]">
                    Øvrige grupper som ikke passer inn i de andre gruppetypene. De migreres én og én: når
                    Omega inkrementeres blir de stående i forrige orden til noen velger hvilke medlemmer
                    som skal videre.
                </p>
                <table className="ohma-table">
                    <thead>
                        <tr>
                            {capabilities.canUpdateManualGroup.authorized && <th>Rediger</th>}
                            <th>Navn</th>
                            <th>Kortnavn</th>
                            <th>Orden</th>
                            <th>Aktive medlemmer</th>
                            <th>Status</th>
                            {capabilities.canDestroyManualGroup.authorized && <th></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Pensioned groups are done with - they belong under the ones still running. */}
                        {[...data.manualGroups]
                            .sort((one, two) => Number(one.group.pensioned) - Number(two.group.pensioned))
                            .map(manualGroup => (
                                <tr key={manualGroup.id}>
                                    {capabilities.canUpdateManualGroup.authorized && (
                                        <td className="text-center">
                                            <PopUp
                                                showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                                                showButtonClass="w-[30px] h-[30px] border-none bg-transparent"
                                                popUpKey={`update manual group ${manualGroup.id}`}
                                            >
                                                <ManualGroupForm manualGroup={manualGroup} />
                                            </PopUp>
                                        </td>
                                    )}
                                    <th>
                                        <Link href={`/admin/manual-groups/${manualGroup.id}`}>
                                            {manualGroup.name}
                                        </Link>
                                    </th>
                                    <td>{manualGroup.shortName}</td>
                                    <td>{orderOfGroup(manualGroup.groupId)}</td>
                                    <td>{membersOfGroup(manualGroup.groupId)}</td>
                                    <td>{manualGroup.group.pensioned ? 'Pensjonert' : 'Aktiv'}</td>
                                    {capabilities.canDestroyManualGroup.authorized && (
                                        <td className="flex gap-2 items-center">
                                            <DestroyManualGroup id={manualGroup.id} name={manualGroup.name} />
                                        </td>
                                    )}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
