import CompanyUserSettings from './CompanyUserSettings'
import { getCompany } from '@/app/(careers)/career/companies/[nameAndId]/getCompany'
import { careerLinks } from '@/app/(careers)/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import { companyUserOperations } from '@/services/careers/companies/users/operations'
import { companyUserAuth } from '@/services/careers/companies/users/auth'
import { companyUserAccountAuth } from '@/services/careers/companies/users/account/auth'
import { Smorekopp } from '@/services/error'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { displayDate } from '@/lib/dates/displayDate'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const sectionClassName = `
    p-8 bg-base-200 border border-careers-line
    max-mobile:p-6
`

/** One user of a company: who they are, and the forms for changing it. */
const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ nameAndId: string, userNameAndId: string }>) => {
        const company = await getCompany(params.nameAndId)
        const companyUser = await companyUserOperations.read({
            params: { id: decodeVevenUriHandleError(params.userNameAndId) },
        })
        // The url names the company too, and must not show another company's user under it.
        if (companyUser.companyId !== company.id) throw new Smorekopp('NOT FOUND')
        return { company, companyUser }
    },
    capabilities: ({ company, companyUser }) => {
        const ownership = { companyId: company.id, companyUserId: companyUser.id }
        return {
            canUpdate: companyUserAuth.update.data(ownership),
            canUpdateRole: companyUserAuth.updateRole.data(ownership),
            canDestroy: companyUserAuth.destroy.data(ownership),
            canSendPasswordLink: companyUserAccountAuth.sendPasswordLink.data(ownership),
        }
    },
    metadata: ({ companyUser }) => ({ title: `${companyUser.firstname} ${companyUser.lastname}` }),
    render: ({ data: { company, companyUser }, capabilities }) => (
        <>
            <section className={sectionClassName}>
                <SiteLink href={careerLinks.companyUsers(company)} className="text-s text-base-content/80">
                    Alle brukere
                </SiteLink>
                <h2 className="mt-2 mb-6 text-l text-careers-navy">
                    {companyUser.firstname} {companyUser.lastname}
                </h2>
                <dl className="
                    grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-m
                    [&>dt]:text-base-content/80
                ">
                    <dt>E-post</dt>
                    <dd>{companyUser.email}{!companyUser.emailVerified && ' (ikke bekreftet)'}</dd>
                    <dt>Rolle</dt>
                    <dd>{companyUser.admin ? 'Administrator for bedriften' : 'Bruker'}</dd>
                    <dt>Status</dt>
                    <dd>{companyUser.active ? 'Aktiv' : 'Deaktivert'}</dd>
                    <dt>Passord</dt>
                    <dd>
                        {companyUser.credentials
                            ? `Sist endret ${displayDate(companyUser.credentials.credentialsUpdatedAt)}`
                            : 'Ikke valgt ennå'}
                    </dd>
                    <dt>Registrert</dt>
                    <dd>{displayDate(companyUser.createdAt)}</dd>
                </dl>
            </section>

            {Object.values(capabilities).some(capability => capability.authorized) && (
                <section className={`
                    ${sectionClassName}
                    flex flex-col gap-8
                `}>
                    <CompanyUserSettings
                        companyUser={companyUser}
                        capabilities={capabilities}
                        usersHref={careerLinks.companyUsers(company)}
                    />
                </section>
            )}
        </>
    ),
})

export default page
export { generateMetadata }
