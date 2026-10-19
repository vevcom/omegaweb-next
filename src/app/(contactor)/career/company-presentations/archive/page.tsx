import styles from './page.module.scss'
import CompanyPresentationArchiveFilters from './CompanyPresentationArchiveFilters'
import ContactorPageHeader from '@/app/(contactor)/_components/ContactorPageHeader'
import { contactorNavDef } from '@/app/(contactor)/_lib/contactorNavDef'
import EventArchiveList from '@/components/Event/EventArchiveList'
import { EventArchivePagingProvider } from '@/contexts/paging/EventArchivePaging'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { eventOperations } from '@/services/events/operations'
import { eventTagOperations } from '@/services/events/tags/operations'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const companyPresentationTag = await eventTagOperations.readSpecial({
            params: { special: 'COMPANY_PRESENTATION' },
        })
        const tagNames = [companyPresentationTag.name]
        const filters = await eventOperations.readArchiveFilters({ params: { tags: tagNames } })

        // Only what the filters offer: anything else in the url would filter on nothing to choose.
        const companyId = QueryParams.companyId.decode(searchParams)
        const year = QueryParams.year.decode(searchParams)
        return {
            tagNames,
            filters,
            companyId: filters.companies.some(company => company.id === companyId) ? companyId : null,
            year: year !== null && filters.years.includes(year) ? year : null,
        }
    },
    metadata: () => ({ title: 'Tidligere bedriftspresentasjoner' }),
    render: ({ data: { tagNames, filters, companyId, year } }) => (
        <>
            <ContactorPageHeader
                badge="Arkiv"
                title="Tidligere bedriftspresentasjoner"
                lead="Bedriftspresentasjonene Contactor har arrangert."
            >
                <Link href={contactorNavDef.companyPresentations.href}>
                    <FontAwesomeIcon icon={faArrowLeft} />Kommende bedriftspresentasjoner
                </Link>
            </ContactorPageHeader>
            {/* Remounted on every change, so its selects start from the filters in effect. */}
            <CompanyPresentationArchiveFilters
                key={`${companyId}-${year}`}
                companies={filters.companies}
                years={filters.years}
                companyId={companyId}
                year={year}
            />
            <div className={styles.list}>
                <EventArchivePagingProvider
                    serverRenderedData={[]}
                    startPage={{ page: 0, pageSize: 12 }}
                    details={{ tags: tagNames, companyId: companyId ?? undefined, year: year ?? undefined }}
                >
                    <EventArchiveList eventBasePath={contactorNavDef.companyPresentations.href} />
                </EventArchivePagingProvider>
            </div>
        </>
    ),
})

export default page
export { generateMetadata }
