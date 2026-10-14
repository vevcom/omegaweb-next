import styles from './page.module.scss'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('lockers', session),
    render: () => (
        <div className={styles.wrapper}>
            <h3>Skapreservasjoner</h3>
            <Link aria-label={'Opprett ny skaplokasjon'} href={'/admin/lockers/location'}>Opprett ny skaplokasjon</Link>
            <Link aria-label={'Opprett nytt skap'} href={'/admin/lockers/locker'}>Opprett nytt skap</Link>
        </div>
    ),
})

export default page
export { generateMetadata }
