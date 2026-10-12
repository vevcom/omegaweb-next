import { updateDefaultPermissionsAction } from '@/services/permissions/actions'
import { permissionOperations } from '@/services/permissions/operations'
import Form from '@/components/Form/Form'
import DisplayAllPermissions from '@/components/Permission/DisplayAllPermissions'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import React from 'react'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('default-permissions', session)
        return permissionOperations.readDefaultPermissions({})
    },
    metadata: () => ({ title: 'Standard Tilganger' }),
    render: ({ data: defaultPermissions }) => (
        <>
            <h1>Standard Tilganger</h1>
            <i>Dette er tilganger alle har på nettsiden uavhengig av innlogging og gruppeafiliasjoner</i>
            <Form submitText="Lagre" action={updateDefaultPermissionsAction}>
                <DisplayAllPermissions renderBesidePermission={
                    permission => (
                        <label>
                            <input
                                type="checkbox"
                                name="permissions"
                                value={permission}
                                defaultChecked={defaultPermissions.includes(permission)}
                            />
                        </label>
                    )
                }
                />
            </Form>
        </>

    ),
})

export default page
export { generateMetadata }
