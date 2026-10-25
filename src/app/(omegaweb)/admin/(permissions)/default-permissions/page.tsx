import { updateDefaultPermissionsAction } from '@/services/permissions/actions'
import { permissionOperations } from '@/services/permissions/operations'
import { permissionsAuth } from '@/services/permissions/auth'
import { permissionsAllowedAsDefault } from '@/services/permissions/constants'
import Form from '@/components/Form/Form'
import DisplayAllPermissions from '@/components/Permission/DisplayAllPermissions'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const allowedAsDefault = permissionsAllowedAsDefault()

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('default-permissions', session)
        return permissionOperations.readDefaultPermissions({})
    },
    capabilities: () => ({
        canUpdateDefaultPermissions: permissionsAuth.updateDefaultPermissions,
    }),
    metadata: () => ({ title: 'Standard Tilganger' }),
    render: ({ data: defaultPermissions, capabilities }) => (
        <>
            <h1>Standard Tilganger</h1>
            <i>Dette er tilganger alle har på nettsiden uavhengig av innlogging og gruppeafiliasjoner</i>
            {capabilities.canUpdateDefaultPermissions.authorized &&
            <Form submitText="Lagre" action={updateDefaultPermissionsAction}>
                <DisplayAllPermissions renderBesidePermission={
                    permission => (
                        <label>
                            <input
                                type="checkbox"
                                name="permissions"
                                value={permission}
                                defaultChecked={defaultPermissions.includes(permission)}
                                disabled={!allowedAsDefault.includes(permission)}
                                title={allowedAsDefault.includes(permission)
                                    ? undefined
                                    : 'Denne tilgangen kan ikke være en standardtilgang'}
                            />
                        </label>
                    )
                }
                />
            </Form>
            }
        </>

    ),
})

export default page
export { generateMetadata }
