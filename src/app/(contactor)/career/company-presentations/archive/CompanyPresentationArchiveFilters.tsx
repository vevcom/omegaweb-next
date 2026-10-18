'use client'
import styles from './CompanyPresentationArchiveFilters.module.scss'
import { contactorNavDef } from '@/app/(contactor)/_lib/contactorNavDef'
import { SelectNumberPossibleNULL } from '@/components/UI/Select'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ARCHIVE_PATH = `${contactorNavDef.companyPresentations.href}/archive`

type Filters = {
    companyId: number | null,
    year: number | null,
}

type PropTypes = Filters & {
    /** The companies and years there are archived company presentations of. */
    companies: { id: number, name: string }[],
    years: number[],
}

/**
 * The company and year filters of the archive of company presentations. They live in the url, so a
 * filtered archive can be shared and the back button takes a choice back; the page hands them on
 * to the paging from there.
 */
export default function CompanyPresentationArchiveFilters({ companies, years, companyId, year }: PropTypes) {
    const { push } = useRouter()

    const filterOn = (filters: Filters) => {
        const query = [
            filters.companyId === null ? null : QueryParams.companyId.encodeUrl(filters.companyId),
            filters.year === null ? null : QueryParams.year.encodeUrl(filters.year),
        ].filter(Boolean).join('&')
        push(query ? `${ARCHIVE_PATH}?${query}` : ARCHIVE_PATH, { scroll: false })
    }

    return (
        <div className={styles.CompanyPresentationArchiveFilters}>
            <SelectNumberPossibleNULL
                name="companyId"
                label="Bedrift"
                background="raised"
                defaultValue={companyId ?? 'NULL'}
                options={[
                    { value: 'NULL', label: 'Alle bedrifter' },
                    ...companies.map(company => ({ value: company.id, label: company.name })),
                ]}
                onChange={value => filterOn({ companyId: value === 'NULL' ? null : value, year })}
            />
            <SelectNumberPossibleNULL
                name="year"
                label="År"
                background="raised"
                defaultValue={year ?? 'NULL'}
                options={[
                    { value: 'NULL', label: 'Alle år' },
                    ...years.map(yearOption => ({ value: yearOption, label: yearOption.toString() })),
                ]}
                onChange={value => filterOn({ companyId, year: value === 'NULL' ? null : value })}
            />
            {(companyId !== null || year !== null) && (
                <Link href={ARCHIVE_PATH} scroll={false} className={styles.reset}>Nullstill filter</Link>
            )}
        </div>
    )
}
