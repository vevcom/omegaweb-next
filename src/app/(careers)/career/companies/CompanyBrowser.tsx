import { companyOperations } from '@/services/careers/companies/operations'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import CompanyList from '@/components/Company/CompanyList'
import { companyListRenderer } from '@/components/Company/CompanyListRenderer'
import CompanyListFilter from '@/components/Company/CompanyListFilter'
import SponsorLegend from '@/components/Company/SponsorLegend'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { PageSizeCompany } from '@/contexts/paging/CompanyPaging'
import type { CompanyExpanded } from '@/services/careers/companies/types'

const pageSize = 10 satisfies PageSizeCompany

type PropTypes = {
    name: string | undefined,
    serverRenderedData: CompanyExpanded[],
    disableEditing?: boolean,
}

/** The first page of companies for `CompanyBrowser`, filtered by the query's name. */
export async function readCompanyBrowser(searchParams: PageOperationArgs['searchParams']) {
    const name = QueryParams.companyName.decode(searchParams) ?? undefined
    const serverRenderedData = await withFallback(
        companyOperations.readPage({
            params: {
                paging: {
                    page: {
                        page: 0,
                        pageSize,
                        cursor: null
                    },
                    details: {
                        name
                    },
                },
            },
        }),
        []
    )
    return { name, serverRenderedData }
}

/** The companies, searchable and paged, on the career site's list of them and on its admin page. */
export default function CompanyBrowser({ name, serverRenderedData, disableEditing = false }: PropTypes) {
    return (
        <CompanyPagingProvider
            serverRenderedData={serverRenderedData}
            startPage={{
                page: 1,
                pageSize
            }}
            details={{
                name
            }}
        >
            <div className="flex flex-row flex-wrap items-center justify-between gap-4 w-full">
                <CompanyListFilter currentName={name ?? ''} />
                <SponsorLegend />
            </div>
            <CompanyList
                disableEditing={disableEditing}
                serverRenderedData={serverRenderedData.map(companyListRenderer({ disableEditing }))}
            />
        </CompanyPagingProvider>
    )
}
