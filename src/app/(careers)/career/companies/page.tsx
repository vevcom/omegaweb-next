import { createCompanyAction } from '@/services/careers/companies/actions'
import { companyOperations } from '@/services/careers/companies/operations'
import { companyAuth } from '@/services/careers/companies/auth'
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
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { PageSizeCompany } from '@/contexts/paging/CompanyPaging'

const pageSize = 10 satisfies PageSizeCompany

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
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
    },
    capabilities: () => ({
        canCreate: companyAuth.create,
    }),
    metadata: () => ({ title: 'Bedrifter' }),
    render: ({ data: { name, serverRenderedData }, capabilities }) => (
        <PageWrapper headerItem={
            capabilities.canCreate.authorized && (
                <AddHeaderItemPopUp title="Ny bedrift" popUpKey="CreateCompany">
                    <Form
                        action={createCompanyAction}
                        refreshOnSuccess
                        closePopUpOnSuccess="CreateCompany"
                        submitText="Lag"
                    >
                        <TextInput name="name" label="Navn" />
                        <TextInput name="description" label="Beskrivelse" />
                    </Form>
                </AddHeaderItemPopUp>
            )
        }>
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
                <CompanyList serverRenderedData={serverRenderedData.map(companyListRenderer())} />
            </CompanyPagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
