'use client'
import SelectCompany from './SelectCompany'
import SponsorBadge from './SponsorBadge'
import CompanySettings from './CompanySettings'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import Image from '@/components/Image/Image'
import SiteLink from '@/components/SiteLink/SiteLink'
import { careerLinks } from '@/app/(careers)/links'
import useAuthorizer from '@/hooks/useAuthorizer'
import { companyAuth } from '@/services/careers/companies/auth'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { CompanyExpanded } from '@/services/careers/companies/types'

const sponsorTierClass = {
    MAIN: `
        border-[color-mix(in_srgb,var(--color-warning),transparent_50%)]
        bg-[color-mix(in_srgb,var(--color-warning),var(--color-base-200)_94%)]
        hover:bg-[color-mix(in_srgb,var(--color-warning),var(--color-base-300)_94%)]
    `,
    SPONSOR: `
        border-[color-mix(in_srgb,var(--color-info),transparent_65%)] bg-base-200
        hover:bg-base-300
    `,
    NONE: `
        border-transparent bg-base-200
        hover:bg-base-300
    `,
} satisfies Record<CompanySponsorTier, string>

type PropTypes = {
    company: CompanyExpanded,
    disableEdit?: boolean,
    logoWidth?: number,
    squareLogo?: boolean
}

/**
 *
 * @param company - The company to display
 * @param disableEdit - If the edit buttons should be disabled even if the user has the rights
 * @param logoWidth - The width of the logo
 * @param squareLogo - If the logo should be square (contained in center of square frame)
 * @returns
 */
export default function Company({
    company,
    disableEdit = false,
    logoWidth = 300,
    squareLogo = true,
}: PropTypes) {
    const canUpdate = useAuthorizer({ authorizer: companyAuth.update })
    const canUpdateSponsorTier = useAuthorizer({ authorizer: companyAuth.updateSponsorTier })
    const canDestroy = useAuthorizer({ authorizer: companyAuth.destroy })
    const canUpdateLogo = useAuthorizer({ authorizer: companyAuth.updateLogo })
    const showSettings = !disableEdit && (
        canUpdate.authorized || canUpdateLogo.authorized || canUpdateSponsorTier.authorized || canDestroy.authorized
    )
    return (
        <div className={`
            relative flex flex-col h-full p-2 border rounded-round transition-[background-color,border-color] duration-300
            ${sponsorTierClass[company.sponsorTier]}
        `}>
            <div className="relative mb-2">
                <div className={`
                    overflow-hidden flex items-center justify-center bg-base-100 rounded-inner [--image-width:100%]
                    tone-light:[&_img]:invert tone-light:[&_img]:hue-rotate-180
                    ${squareLogo ? `
                        aspect-square
                        [&_div]:size-full
                        [&_img]:size-full [&_img]:object-contain
                    ` : ''}
                `}>
                    {company.logoImage ? (
                        <Image
                            image={company.logoImage}
                            alt={company.name}
                            width={logoWidth}
                            hideCredit
                            hideCopyRight
                            disableLinkingToLicense
                        />
                    ) : (
                        <span className="p-4 text-l font-medium text-center text-base-content/80">{company.name}</span>
                    )}
                </div>
                <SponsorBadge sponsorTier={company.sponsorTier} iconOnly className="
                    absolute top-2 left-2 max-w-[calc(100%-4*var(--gap))] z-1
                " />
            </div>
            <div className={`
                mx-2 pb-2 relative flex-1
                [&_h2]:text-l [&_h2]:truncate
                [&_p]:text-base-content/80
                ${showSettings ? 'pr-10' : ''}
            `}>
                <h2>
                    <SiteLink href={careerLinks.company(company)} className="relative z-1 text-inherit">
                        {company.name}
                    </SiteLink>
                </h2>
                <p>{company.description}</p>
                {
                    showSettings ? (
                        <SettingsHeaderItemPopUp
                            showButtonClass="text-base-content absolute top-0 right-0 z-2"
                            popUpKey={`Edit ${company.id}`}
                        >
                            <CompanySettings company={company} closePopUpOnSuccess={`Edit ${company.id}`} />
                        </SettingsHeaderItemPopUp>
                    ) : <></>
                }
            </div>
            <SelectCompany company={company} />
        </div>
    )
}
