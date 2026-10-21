import PermissionCheckbox from './PermissionCheckbox'
import { permissionConfig } from '@/services/permissions/constants'
import { permissionOperations } from '@/services/permissions/operations'
import { serverPage } from '@/app/ServerPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { Permission } from '@/prisma-generated-pn-types'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('group-permissions', session)
        return permissionOperations.readPermissionMatrix({})
    },
    metadata: () => ({ title: 'Gruppetillatelser' }),
    render: ({ data: permissionMatrix }) => {
        const permissionList = Object.keys(permissionConfig)

        return <div className="overflow-auto h-[calc(100vh-5rem)] w-full">
            <table className="block border-spacing-0">
                <thead
                    className="
                        align-bottom
                        [&_th]:whitespace-nowrap [&_th]:px-[0.2rem] [&_th]:pb-[0.3rem] [&_th]:sticky [&_th]:top-0
                        [&_th]:z-2 [&_th]:bg-surface-base [&_th]:border-b-2 [&_th]:border-black
                    "
                >
                    <tr>
                        <th>Gruppe</th>
                        {permissionList.map((permission, i) =>
                            <th
                                key={i}
                                className="
                                    [&>span]:[writing-mode:vertical-rl] [&>span]:rotate-180 [&>span]:whitespace-nowrap
                                "
                                title={permissionConfig[permission as Permission].description}
                            >
                                <span>{permissionConfig[permission as Permission].name}</span>
                            </th>
                        )}
                    </tr>
                </thead>

                <tbody>
                    {permissionMatrix.map((group, i) => (
                        <tr key={i}>
                            <td
                                className="
                                    text-nowrap text-right sticky pr-[0.3rem] left-0 z-1 bg-surface-base border-r-2
                                    border-black
                                "
                            >
                                {group.name}
                            </td>
                            {permissionList.map((permission, j) => {
                                const hasPermission = group.permissions.includes(permission as Permission)
                                return <td key={j}>
                                    <PermissionCheckbox
                                        groupId={group.id}
                                        permission={permission as Permission}
                                        value={hasPermission}
                                    />
                                </td>
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    },
})

export default page
export { generateMetadata }
