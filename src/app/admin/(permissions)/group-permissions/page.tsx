import styles from './page.module.scss'
import PermissionCheckbox from './PermissionCheckbox'
import { permissionConfig } from '@/services/permissions/constants'
import { permissionOperations } from '@/services/permissions/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { Permission } from '@/prisma-generated-pn-types'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('group-permissions', session)
        return permissionOperations.readPermissionMatrix({})
    },
    metadata: () => ({ title: 'Gruppetillatelser' }),
    render: ({ data: permissionMatrix }) => {
        const permissionList = Object.keys(permissionConfig)

        return <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead className={styles.tableHead}>
                    <tr>
                        <th>Gruppe</th>
                        {permissionList.map((permission, i) =>
                            <th
                                key={i}
                                className={styles.permissionTH}
                                title={permissionConfig[permission as Permission].description}
                            >
                                <span>{permissionConfig[permission as Permission].name}</span>
                            </th>
                        )}
                    </tr>
                </thead>

                <tbody className={styles.tableBody}>
                    {permissionMatrix.map((group, i) => (
                        <tr key={i}>
                            <td className={styles.groupName}>{group.name}</td>
                            {permissionList.map((permission, j) => {
                                const hasPermission = group.permissions.includes(permission as Permission)
                                return <td key={j} className={styles.permissionTD}>
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
