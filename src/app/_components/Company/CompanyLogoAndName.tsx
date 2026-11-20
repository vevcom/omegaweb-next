import Image from '@/components/Image/Image'
import SiteLink from '@/components/SiteLink/SiteLink'
import { careerLinks } from '@/app/(careers)/links'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { CompanyExpanded } from '@/services/careers/companies/types'

type PropTypes = {
    company: Pick<CompanyExpanded, 'id' | 'name' | 'logoImage'>,
    /**
     * Whether the name links to the company's page, which takes more to see than what shows the
     * company. Left out inside what is a link itself, such as a card.
     */
    capabilities?: Capabilities<'canReadCompany'>,
}

/** A company as something else shows it, by its logo and name on one line. */
export default function CompanyLogoAndName({ company, capabilities }: PropTypes) {
    return (
        <div className="flex items-center gap-2">
            {company.logoImage && <Image
                image={company.logoImage}
                alt={company.name}
                width={80}
                hideCredit
                hideCopyRight
                disableLinkingToLicense
                imageContainerClassName="
                    shrink-0 h-6
                    [&>img]:object-contain [&>img]:object-left
                    tone-light:[&_img]:invert tone-light:[&_img]:hue-rotate-180
                "
            />}
            {capabilities?.canReadCompany.authorized
                ? <SiteLink href={careerLinks.company(company)} className="truncate">{company.name}</SiteLink>
                : <span className="truncate">{company.name}</span>}
        </div>
    )
}
