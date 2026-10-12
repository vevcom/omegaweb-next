import CreateLockerLocationForm from './CreateLockerLocationForm'
import { lockerLocationAuth } from '@/services/lockers/locations/auth'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => ({}),
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
