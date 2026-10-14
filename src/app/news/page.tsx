import styles from './page.module.scss'
import AddNews from './AddNews'
import CurrentNews from './CurrentNews'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { newsAuth } from '@/services/news/auth'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => ({}),
    capabilities: () => ({
        canCreate: newsAuth.create,
    }),
    metadata: () => ({ title: 'Nyheter' }),
    render: ({ capabilities }) => (
        <PageWrapper
            headerItem={
                <div className={styles.head}>
                    <ArchiveLink href="news/archive" />
                    {
                        capabilities.canCreate.authorized && (
                            <AddHeaderItemPopUp popUpKey="createNewsPop">
                                <AddNews />
                            </AddHeaderItemPopUp>
                        )
                    }
                </div>
            }
        >
            <main className={styles.wrapper}>
                <CurrentNews />
            </main>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
