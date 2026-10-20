'use client'
import useAuthorizer from '@/hooks/useAuthorizer'
import { reportAuth } from '@/services/report/auth'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShieldHeart } from '@fortawesome/free-solid-svg-icons'

export default function ReportButton() {
    const canRead = useAuthorizer({ authorizer: reportAuth.read }).authorized

    if (!canRead) return <></>

    return (
        <div className="cursor-pointer">
            <Link href="/report" className="group flex items-center justify-center size-12">
                <FontAwesomeIcon
                    className="size-[30px]! text-text transition-colors duration-300 [&_path]:text-inherit group-hover:text-accent-red"
                    icon={faShieldHeart}
                />
            </Link>
        </div>

    )
}
