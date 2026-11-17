import { companyNavDef } from '@/app/(careers)/career/companies/[nameAndId]/companyNavDef'
import { getCompany } from '@/app/(careers)/career/companies/[nameAndId]/getCompany'
import { careerLinks } from '@/app/(careers)/links'
import CompanySettings from '@/components/Company/CompanySettings'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

/** The forms for managing a company. Each form is shown to those its own authorizer lets through. */
const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
        const company = await getCompany(params.nameAndId)
        await companyNavDef(company).authorize('settings', session)
        return company
    },
    metadata: company => ({ title: `Innstillinger for ${company.name}` }),
    render: ({ data: company }) => (
        <section className="
            flex flex-col gap-8 p-8 bg-base-200 border border-careers-line
            max-mobile:p-6
        ">
            <CompanySettings company={company} navigateOnDestroy={careerLinks.companies()} />
        </section>
    ),
})

export default page
export { generateMetadata }
