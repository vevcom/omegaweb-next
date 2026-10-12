import styles from './page.module.scss'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { createCompanyAction, readCompanyPageAction } from '@/services/career/companies/actions'
import Form from '@/components/Form/Form'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import TextInput from '@/components/UI/TextInput'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import CompanyList from '@/components/Company/CompanyList'
import { companyListRenderer } from '@/components/Company/CompanyListRenderer'
import SponsorLegend from '@/components/Company/SponsorLegend'
import { QueryParams } from '@/lib/queryParams/queryParams'
import CompanyListFilter from '@/app/_components/Company/CompanyListFilter'
import { configureAction } from '@/services/configureAction'
import type { SearchParamsServerSide } from '@/lib/queryParams/types'
import type { PageSizeCompany } from '@/contexts/paging/CompanyPaging'

type PropTypes = SearchParamsServerSide

export default async function CompaniesPage({ searchParams }: PropTypes) {
    const pageSize = 10 satisfies PageSizeCompany
    const name = QueryParams.companyName.decode(await searchParams) ?? undefined

    const res = await configureAction(readCompanyPageAction, {
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
        }
    })()

    const serverRenderedData = res.success ? res.data : []

    return (
        <PageWrapper headerItem={
            <AddHeaderItemPopUp popUpKey="CreateCompany">
                <Form
                    title="Ny bedrift"
                    action={createCompanyAction}
                    refreshOnSuccess
                    closePopUpOnSuccess="CreateCompany"
                    submitText="Lag"
                >
                    <TextInput name="name" label="Navn" />
                    <TextInput name="description" label="Beskrivelse" />
                </Form>
            </AddHeaderItemPopUp>
        }>
            <PageTitleSetter title="Bedrifter" />
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
                <div className={styles.toolbar}>
                    <CompanyListFilter currentName={name ?? ''} />
                    <SponsorLegend />
                </div>
                <CompanyList serverRenderedData={serverRenderedData.map(companyListRenderer())} />
            </CompanyPagingProvider>
        </PageWrapper>
    )
}
