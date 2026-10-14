import CreateLockerLocationForm from './CreateLockerLocationForm'
import { lockerLocationAuth } from '@/services/lockers/locations/auth'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('lockers', session),
    capabilities: () => ({
        canCreateLockerLocation: lockerLocationAuth.create,
    }),
    render: ({ capabilities }) => (
        <div>
            {capabilities.canCreateLockerLocation.authorized && <CreateLockerLocationForm />}
        </div>
    ),
})

export default page
export { generateMetadata }
