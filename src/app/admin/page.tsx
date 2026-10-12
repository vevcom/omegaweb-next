import styles from './page.module.scss'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage(null, session),
    render: () => (
        <div className={styles.wrapper}>
            <FontAwesomeIcon icon={faScrewdriverWrench} className={styles.icon} />
            <p>Velg en ting å administrere i menyen</p>
        </div>
    ),
})

export default page
export { generateMetadata }
