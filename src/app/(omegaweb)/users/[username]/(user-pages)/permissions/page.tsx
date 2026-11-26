import Card from '@/components/UI/Card'
import Permission from '@/components/Permission/Permission'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { permissionOperations } from '@/services/permissions/operations'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'permissions', session)
        return permissionOperations.readPermissionsOfUser({ params: { userId: profile.user.id } })
    },
    render: ({ data: permissions }) => (
        <Card>
            <h2>Tilganger:</h2>
            <ul>
                {permissions.map(permission =>
                    <Permission key={permission} permission={permission} className="mb-[1em]" />
                )}
            </ul>
        </Card>
    ),
})

export default page
export { generateMetadata }
