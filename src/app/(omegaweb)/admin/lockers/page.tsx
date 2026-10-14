import styles from './page.module.scss'
import CreateLockerForm from './CreateLockerForm'
import CreateLockerLocationForm from './CreateLockerLocationForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import SimpleTable from '@/components/Table/SimpleTable'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { lockerLocationOperations } from '@/services/lockers/locations/operations'
import { lockerAuth } from '@/services/lockers/auth'
import { lockerLocationAuth } from '@/services/lockers/locations/auth'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('lockers', session)
        return lockerLocationOperations.readAll({})
    },
    capabilities: () => ({
        canCreateLocker: lockerAuth.create,
        canCreateLockerLocation: lockerLocationAuth.create,
    }),
    metadata: () => ({ title: 'Administrer skap' }),
    render: ({ data: locations, capabilities }) => {
        const sortedLocations = [...locations].sort(
            (one, two) => one.building.localeCompare(two.building, 'nb') || one.floor - two.floor
        )

        return (
            <PageWrapper headerItem={
                <div className={styles.header}>
                    {capabilities.canCreateLockerLocation.authorized && (
                        <AddHeaderItemPopUp popUpKey="create_locker_location" label="Ny lokasjon">
                            <CreateLockerLocationForm />
                        </AddHeaderItemPopUp>
                    )}
                    {capabilities.canCreateLocker.authorized && (
                        <AddHeaderItemPopUp popUpKey="create_locker" label="Nytt skap">
                            <CreateLockerForm locations={sortedLocations} />
                        </AddHeaderItemPopUp>
                    )}
                </div>
            }>
                <h2>Skaplokasjoner</h2>
                <SimpleTable
                    header={['Bygning', 'Etasje']}
                    body={sortedLocations.map(location => [location.building, `${location.floor}.`])}
                />
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
