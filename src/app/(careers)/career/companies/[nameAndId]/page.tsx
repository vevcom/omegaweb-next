import { careerLinks } from '@/app/(careers)/links'
import { badgeClassName, sectionHeadingClassName } from '@/app/(careers)/_lib/careersClassNames'
import CompanySettings from '@/components/Company/CompanySettings'
import SponsorBadge from '@/components/Company/SponsorBadge'
import Image from '@/components/Image/Image'
import SiteLink from '@/components/SiteLink/SiteLink'
import { companyOperations } from '@/services/careers/companies/operations'
import { companyAuth } from '@/services/careers/companies/auth'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { hrefOf } from '@/lib/sites/href'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const LOGO_WIDTH = 320

/**
 * The page of one company: what the public is told about it and, for those who may manage the
 * company, the forms for doing so.
 */
const { page, generateMetadata } = serverPage({
    operation: ({ params }: PageOperationArgs<{ nameAndId: string }>) =>
        companyOperations.read({ params: { id: decodeVevenUriHandleError(params.nameAndId) } }),
    capabilities: () => ({
        canUpdate: companyAuth.update,
        canUpdateLogo: companyAuth.updateLogo,
        canUpdateSponsorTier: companyAuth.updateSponsorTier,
        canDestroy: companyAuth.destroy,
    }),
    metadata: company => ({
        title: company.name,
        description: company.description || undefined,
    }),
    render: ({ data: company, capabilities }) => {
        const canManage = Object.values(capabilities).some(capability => capability.authorized)
        return (
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

                <section className="
                    flex flex-row items-start gap-8 p-8 bg-base-200 border border-careers-line
                    max-mobile:flex-col max-mobile:p-6
                ">
                    {company.logoImage && (
                        <div className="
                            shrink-0 w-48
                            max-mobile:w-40
                            [&>div]:w-full
                            [&_img]:h-auto [&_img]:object-contain
                            tone-light:[&_img]:invert tone-light:[&_img]:hue-rotate-180
                        ">
                            <Image
                                image={company.logoImage}
                                alt={company.name}
                                width={LOGO_WIDTH}
                                hideCredit
                                hideCopyRight
                                disableLinkingToLicense
                            />
                        </div>
                    )}
                    <div className="flex flex-col gap-4 text-m">
                        {company.description && <p>{company.description}</p>}
                        {company.website && (
                            <SiteLink href={hrefOf(company.website)} target="_blank" rel="noreferrer">
                                {company.website}
                            </SiteLink>
                        )}
                        {!company.description && !company.website && (
                            <p className="text-base-content/80">Bedriften har ikke lagt inn noe om seg selv ennå.</p>
                        )}
                    </div>
                </section>

                {canManage && (
                    <section className="
                        p-8 bg-base-200 border border-careers-line
                        max-mobile:p-6
                    ">
                        <h2 className="mb-6 text-l text-careers-navy">Administrer bedriften</h2>
                        <div className="flex flex-col gap-8">
                            <CompanySettings company={company} navigateOnDestroy={careerLinks.companies()} />
                        </div>
                    </section>
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }
