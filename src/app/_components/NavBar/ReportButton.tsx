'use client'
import useAuthorizer from '@/hooks/useAuthorizer'
import { reportAuth } from '@/services/report/auth'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShieldHeart } from '@fortawesome/free-solid-svg-icons'

export default function ReportButton() {
    const canRead = useAuthorizer({ authorizer: reportAuth.read }).authorized

    if (!canRead) return <></>

    return (
        <div className="cursor-pointer">
            <SiteLink href={appHref('/report')} className="group flex items-center justify-center size-12">
                <FontAwesomeIcon
                    className="
                        size-5! text-base-content transition-colors duration-300
                        [&_path]:text-inherit
                        group-hover:text-primary
                    "
                    icon={faShieldHeart}
                />
            </SiteLink>
        </div>

    )
}
