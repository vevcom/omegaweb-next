import { careerLinks } from '@/app/(careers)/links'
import { companyAuth } from '@/services/careers/companies/auth'
import { companyUserAuth } from '@/services/careers/companies/users/auth'
import { defineNavDef } from '@/lib/navDef/navDef'
import { faBuilding, faCog, faUsers } from '@fortawesome/free-solid-svg-icons'

/** The pages of a company, in the order the tabs show them. */
export function companyNavDef(company: { id: number, name: string }) {
    const ownership = { companyId: company.id }
    return defineNavDef([
        {
            key: 'overview',
            name: 'Oversikt',
            href: careerLinks.company(company),
            icon: faBuilding,
            authorizers: () => [companyAuth.read.data(ownership)],
        },
        {
            key: 'users',
            name: 'Brukere',
            href: careerLinks.companyUsers(company),
            icon: faUsers,
            authorizers: () => [companyUserAuth.readOfCompany.data(ownership)],
        },
        {
            key: 'settings',
            name: 'Innstillinger',
            href: careerLinks.companySettings(company),
            icon: faCog,
            authorizers: () => [
                companyAuth.update.data(ownership),
                companyAuth.updateLogo.data(ownership),
                companyAuth.updateSponsorTier,
                companyAuth.destroy,
            ],
        },
    ])
}
