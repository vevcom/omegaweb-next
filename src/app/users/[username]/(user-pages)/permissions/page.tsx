import styles from './page.module.scss'
import Permission from '@/components/Permission/Permission'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import { permissionOperations } from '@/services/permissions/operations'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'permissions', session)
        return permissionOperations.readPermissionsOfUser({ params: { userId: profile.user.id } })
    },
    render: ({ data: permissions }) => (
        <div className={styles.wrapper}>
            <h2>Tillganger:</h2>
            <ul>
                {permissions.map(permission =>
                    <Permission key={permission} permission={permission} className={styles.permission} />
                )}
            </ul>
        </div>
    ),
})

export default page
export { generateMetadata }
