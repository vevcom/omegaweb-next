import RevueRow from './RevueRow'
import CreateRevueForm from '@/app/(revue)/_components/CreateRevueForm'
import { revueAdminNavDef } from '@/app/(revue)/revue/admin/revueAdminNavDef'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { revueAuth } from '@/services/revue/auth'
import { revueOperations } from '@/services/revue/operations'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const createPopUpKey = 'CreateRevue'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await revueAdminNavDef.authorize('revues', session)
        return revueOperations.readMany({})
    },
    capabilities: () => ({
        canCreate: revueAuth.create,
        canUpdate: revueAuth.update,
        canDestroy: revueAuth.destroy,
    }),
    metadata: () => ({ title: 'Revyer' }),
    render: ({ data: revues, capabilities }) => (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
                <h1 className="m-0">Revyer</h1>
                {capabilities.canCreate.authorized && <AddHeaderItemPopUp popUpKey={createPopUpKey}>
                    <CreateRevueForm closePopUpOnSuccess={createPopUpKey} />
                </AddHeaderItemPopUp>}
            </div>
            <p className="m-0 text-base-content/80">
                Den nyeste revyen er den forsiden løfter frem. Navnet til en revy er navnet på artikkelen dens.
            </p>
            {revues.length === 0
                ? <p className="m-0 text-base-content/80">Det er ingen revyer ennå.</p>
                : <ul className="m-0 p-0 list-none border-b border-base-300">
                    {revues.map(revue => <RevueRow
                        key={revue.id}
                        revue={{ id: revue.id, year: revue.year, name: revue.name }}
                        capabilities={capabilitiesToJsObject({
                            canUpdate: capabilities.canUpdate,
                            canDestroy: capabilities.canDestroy,
                        })}
                    />)}
                </ul>}
        </div>
    ),
})

export default page
export { generateMetadata }
