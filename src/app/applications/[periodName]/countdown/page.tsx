import styles from './page.module.scss'
import Countdown from './Countdown'
import { applicationPeriodOperations } from '@/services/applications/periods/operations'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ periodName: string }>) =>
        applicationPeriodOperations.read({
            params: {
                name: decodeURIComponent(params.periodName)
            }
        }),
    render: ({ data: period }) => (
        <div className={styles.wrapper}>
            <Countdown period={period} />
        </div>
    ),
})

export default page
export { generateMetadata }
