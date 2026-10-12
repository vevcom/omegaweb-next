'use client'
import styles from './ReportButton.module.scss'
import useAuthorizer from '@/hooks/useAuthorizer'
import { reportAuth } from '@/services/report/auth'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShieldHeart } from '@fortawesome/free-solid-svg-icons'

export default function ReportButton() {
    const canRead = useAuthorizer({ authorizer: reportAuth.read }).authorized

    if (!canRead) return <></>

    return (
        <div className={styles.reportButton}>
            <Link href="/report">
                <FontAwesomeIcon className={styles.reportPicture} icon={faShieldHeart} />
            </Link>
        </div>

    )
}
