import styles from './page.module.scss'
import { schoolOperations } from '@/services/education/schools/operations'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { SchoolPagingProvider } from '@/contexts/paging/SchoolPaging'
import SchoolList from '@/components/School/SchoolList'
import { schoolAuth } from '@/services/education/schools/auth'
import { schoolListRenderer } from '@/components/School/SchoolListRenderer'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'
import type { PageSizeSchool } from '@/contexts/paging/SchoolPaging'

const pageSizeSchool: PageSizeSchool = 8

const { page, generateMetadata } = serverPage({
    operation: async () => schoolOperations.readExpandedPage({
        params: {
            paging: {
                page: { pageSize: pageSizeSchool, page: 0, cursor: null },
                details: undefined,
            },
        },
    }),
    capabilities: () => ({
        canAdministrateSchools: schoolAuth.create,
    }),
    metadata: () => ({ title: 'Skoler' }),
    render: ({ data: serverRenderedData, capabilities }) => (
        <PageWrapper headerItem={
            capabilities.canAdministrateSchools.authorized ? (
                <Link href="/admin/schools" className={styles.adminLink}>
                    Gå til administrasjon
                </Link>
            ) : <></>
        }>
            <SchoolPagingProvider
                serverRenderedData={serverRenderedData}
                details={undefined}
                startPage={{ pageSize: pageSizeSchool, page: 1 }}
            >
                <div className={styles.wrapper}>
                    <SchoolList serverRendered={serverRenderedData.map(schoolListRenderer)} />
                </div>
            </SchoolPagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
