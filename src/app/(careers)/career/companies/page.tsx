import CompanyBrowser, { readCompanyBrowser } from './CompanyBrowser'
import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { companyAuth } from '@/services/careers/companies/auth'
import HeaderItemLink from '@/components/HeaderItems/HeaderItemLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/ServerPage'
import { faTools } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ searchParams }: PageOperationArgs) => readCompanyBrowser(searchParams),
    capabilities: () => ({
        canAdminister: companyAuth.create,
    }),
    metadata: () => ({ title: 'Bedrifter' }),
    render: ({ data, capabilities }) => (
        <PageWrapper headerItem={
            capabilities.canAdminister.authorized && (
                <HeaderItemLink href={careerAdminNavDef.href('companies')} label="Administrer" icon={faTools} />
            )
        }>
            <CompanyBrowser {...data} disableEditing />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
