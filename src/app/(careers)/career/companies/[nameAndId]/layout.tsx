import CompanyTabs from './CompanyTabs'
import { companyNavDef } from './companyNavDef'
import { getCompany } from './getCompany'
import { careerLinks } from '@/app/(careers)/links'
import { badgeClassName, sectionHeadingClassName } from '@/app/(careers)/_lib/careersClassNames'
import SponsorBadge from '@/components/Company/SponsorBadge'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverLayout } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

/** The frame of a company's pages: its name, and the tabs the viewer may open. */
export default serverLayout({
    operation: async ({ params, session }: LayoutOperationArgs<{ nameAndId: string }>) => {
        const company = await getCompany(params.nameAndId)
        return { company, navLinks: await companyNavDef(company).visible(session) }
    },
    render: ({ data: { company, navLinks }, children }) => (
        <div className="flex flex-col gap-8 max-w-3xl py-16">
            <div>
                <SiteLink href={careerLinks.companies()} className={`
                    ${badgeClassName}
                    text-careers-accent-dark
                `}>Bedrifter</SiteLink>
                <h1 className={`
                    ${sectionHeadingClassName}
                    text-careers-navy
                `}>{company.name}</h1>
                <SponsorBadge sponsorTier={company.sponsorTier} className="mt-4" />
            </div>
            {/* One tab is the page everyone sees, which needs no tabs to be found. */}
            {navLinks.length > 1 && <CompanyTabs links={navLinks} />}
            {children}
        </div>
    ),
})
