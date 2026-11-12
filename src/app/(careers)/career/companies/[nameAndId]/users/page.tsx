import { getCompany } from '@/app/(careers)/career/companies/[nameAndId]/getCompany'
import { careerLinks } from '@/app/(careers)/links'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Checkbox from '@/components/UI/Checkbox'
import SiteLink from '@/components/SiteLink/SiteLink'
import { companyUserOperations } from '@/services/careers/companies/users/operations'
import { companyUserAuth } from '@/services/careers/companies/users/auth'
import { createCompanyUserAction } from '@/services/careers/companies/users/actions'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const sectionClassName = `
    p-8 bg-base-200 border border-careers-line
    max-mobile:p-6
`

/** The users of a company, and the form for registering a new one. */
const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ nameAndId: string }>) => {
        const company = await getCompany(params.nameAndId)
        const companyUsers = await companyUserOperations.readOfCompany({ params: { companyId: company.id } })
        return { company, companyUsers }
    },
    capabilities: () => ({
        canCreate: companyUserAuth.create,
    }),
    metadata: ({ company }) => ({ title: `Brukere i ${company.name}` }),
    render: ({ data: { company, companyUsers }, capabilities }) => (
        <>
            <section className={sectionClassName}>
                <h2 className="mb-6 text-l text-careers-navy">Brukere</h2>
                {companyUsers.length === 0 ? (
                    <p className="text-m text-base-content/80">Bedriften har ingen brukere ennå.</p>
                ) : (
                    <ul className="flex flex-col list-none divide-y divide-careers-line">
                        {companyUsers.map(companyUser => (
                            <li key={companyUser.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
                                <SiteLink
                                    href={careerLinks.companyUser(company, companyUser)}
                                    className="text-m font-semibold text-careers-navy"
                                >
                                    {companyUser.firstname} {companyUser.lastname}
                                </SiteLink>
                                <span className="text-s text-base-content/80">{companyUser.email}</span>
                                {companyUser.admin && (
                                    <span className="text-s font-semibold text-careers-accent-dark">Administrator</span>
                                )}
                                {!companyUser.active && (
                                    <span className="text-s font-semibold text-warning">Deaktivert</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {capabilities.canCreate.authorized && (
                <section className={sectionClassName}>
                    <Form
                        title="Registrer en bruker"
                        action={configureAction(createCompanyUserAction, { params: { companyId: company.id } })}
                        refreshOnSuccess
                        submitText="Registrer"
                    >
                        <TextInput name="firstname" label="Fornavn" />
                        <TextInput name="lastname" label="Etternavn" />
                        <TextInput name="email" label="E-post" />
                        <Checkbox name="admin" label="Administrator for bedriften" />
                    </Form>
                </section>
            )}
        </>
    ),
})

export default page
export { generateMetadata }
