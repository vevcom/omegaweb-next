import styles from './page.module.scss'
import CreateLockerForm from './CreateLockerForm'
import { lockerLocationOperations } from '@/services/lockers/locations/operations'
import { lockerAuth } from '@/services/lockers/auth'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('lockers', session)
        return lockerLocationOperations.readAll({})
    },
    capabilities: () => ({
        canCreateLocker: lockerAuth.create,
    }),
    render: ({ data: locations, capabilities }) => (
        <div className={styles.wrapper}>
            {capabilities.canCreateLocker.authorized && <CreateLockerForm locations={locations}/>}
        </div>
    ),
})

export default page
export { generateMetadata }
