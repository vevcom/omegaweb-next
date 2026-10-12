import styles from './page.module.scss'
import OldNewsList from './OldNewsList'
import NewsCard from '@/app/news/NewsCard'
import { OldNewsPagingProvider } from '@/contexts/paging/OldNewsPaging'
import { newsOperations } from '@/services/news/operations'
import { serverPage } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { PageSizeOldNews } from '@/contexts/paging/OldNewsPaging'

const pageSize: PageSizeOldNews = 20

const { page, generateMetadata } = serverPage({
    operation: async () => newsOperations.readOldPage({
        params: {
            paging: {
                page: {
                    page: 0,
                    pageSize,
                    cursor: null,
                },
                details: undefined
            },
        }
    }),
    metadata: () => ({ title: 'Nyhetsarkiv' }),
    render: ({ data: serverRendered }) => (
        <PageWrapper headerItem={
            <Link href="/news" className={styles.backLink}>
                <FontAwesomeIcon icon={faArrowLeft} />
            </Link>
        }>
            <OldNewsPagingProvider
                startPage={{
                    page: 1,
                    pageSize,
                }}
                details={undefined}
                serverRenderedData={serverRendered}
            >
                <OldNewsList serverRendered={serverRendered.map(news => <NewsCard key={news.id} news={news} />)} />
            </OldNewsPagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
