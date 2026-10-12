import styles from './page.module.scss'
import CreateOrder from './CreateOrder'
import Requirements from './Requirements'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Date from '@/components/Date/Date'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        // The page's whole point is incrementing the order, so it is gated on `create`
        // rather than the read auth the operations themselves enforce.
        authorizeAdminPage('stateOfOmega', session)

        const [currentOrder, requirements] = await Promise.all([
            omegaOrderOperations.readCurrent({}),
            omegaOrderOperations.readRequirements({}),
        ])
        return { currentOrder, requirements }
    },
    metadata: () => ({ title: 'Omegas tilstand' }),
    render: ({ data }) => {
        const allRequirementsFulfilled = data.requirements.every(requirement => requirement.fulfilled)

        return (
            <div className={styles.wrapper}>
                <div className={styles.plaque}>
                    <p className={styles.label}>Omega er i orden</p>
                    <h1 className={styles.order}>{ data.currentOrder.order }</h1>
                </div>
                <p className={styles.lastIncremented}>
                    Ordenen til Omega ble sist inkrementert{' '}
                    <Date date={data.currentOrder.createdAt} includeTime={false} />
                </p>
                <div className={styles.requirements}>
                    <Requirements requirements={data.requirements} />
                </div>
                <CreateOrder allRequirementsFulfilled={allRequirementsFulfilled} />
            </div>
        )
    },
})

export default page
export { generateMetadata }
