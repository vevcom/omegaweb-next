import { careerLinks } from '@/app/(careers)/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBuilding } from '@fortawesome/free-solid-svg-icons'
import type { CompanyUserOfSession } from '@/services/careers/companies/users/types'

type PropTypes = {
    /** The company user of the session, null for a session that is not a company user's. */
    companyUser: CompanyUserOfSession | null,
}

/**
 * Shown on the sites a company user has no use of: they are signed in for the career site alone,
 * and this is the way back to it. Renders nothing for everyone else.
 */
export default function CompanyUserBand({ companyUser }: PropTypes) {
    if (!companyUser) return null
    return (
        <aside
            role="note"
            className="
                flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3 bg-info text-info-content text-m
                font-medium text-center
            "
        >
            <FontAwesomeIcon icon={faBuilding} className="shrink-0" />
            <span>
                Du er logget inn som bedriftsbruker for {companyUser.company.name}. Det du kan gjøre som bedrift,
                finner du på{' '}
                <SiteLink
                    href={careerLinks.company(companyUser.company)}
                    toMainDomainServingSite
                    className="font-semibold text-inherit underline"
                >
                    karrieresiden
                </SiteLink>.
            </span>
        </aside>
    )
}
