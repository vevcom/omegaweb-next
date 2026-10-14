import styles from './page.module.scss'
import { serverPage } from '@/app/ServerPage'

/** Contactor's "about us" page. Empty for now: the frontpage links here from its "om oss" section. */
const { page, generateMetadata } = serverPage({
    operation: async () => ({}),
    metadata: () => ({ title: 'Om oss' }),
    render: () => (
        <div className={styles.page}>
            <h1>Om Contactor</h1>
            <p>Her kommer det mer om oss.</p>
        </div>
    ),
})

export default page
export { generateMetadata }
