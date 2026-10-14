import styles from './page.module.scss'
import OmegaId from '@/components/OmegaId/Identification/OmegaId'
import { serverPage } from '@/app/ServerPage'
import { forbidden, notFound, redirect } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        if (!session.user) notFound()

        if (params.username === 'me') {
            redirect(`/users/${session.user.username}/omegaid`)
        }

        if (params.username !== session.user.username) {
            forbidden()
        }
    },
    metadata: () => ({ title: 'OmegaId' }),
    render: () => (
        <div className={styles.wrapper}>
            <OmegaId />
        </div>
    ),
})

export default page
export { generateMetadata }
