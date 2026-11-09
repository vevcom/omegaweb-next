import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import CompanyBrowser, { readCompanyBrowser } from '@/app/(careers)/career/companies/CompanyBrowser'
import { createCompanyAction } from '@/services/careers/companies/actions'
import Form from '@/components/Form/Form'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import TextInput from '@/components/UI/TextInput'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session, searchParams }: PageOperationArgs) => {
        await careerAdminNavDef.authorize('companies', session)
        return readCompanyBrowser(searchParams)
    },
    metadata: () => ({ title: 'Bedrifter' }),
    render: ({ data }) => (
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
            <CompanyBrowser {...data} />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
