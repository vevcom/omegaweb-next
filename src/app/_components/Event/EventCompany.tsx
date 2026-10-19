import styles from './EventCompany.module.scss'
import Image from '@/components/Image/Image'
import Link from 'next/link'
import { faBuilding } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { CompanyOfEvent } from '@/services/events/types'

const LOGO_WIDTH = 200

/**
 * The company an event is held with or for, in the aside of the event page: its name, linking to
 * its website when it has one, and its logo.
 */
export default function EventCompany({ company }: { company: CompanyOfEvent }) {
    return (
        <>
            <p>
                <FontAwesomeIcon icon={faBuilding} />
                <span>
                    Bedrift: {company.website
                        ? <Link href={company.website} target="_blank" rel="noreferrer">{company.name}</Link>
                        : company.name}
                </span>
            </p>
            {company.logo.image && <Image
                image={company.logo.image}
                alt={company.name}
                width={LOGO_WIDTH}
                className={styles.logo}
                hideCredit
                hideCopyRight
                disableLinkingToLicense
            />}
        </>
    )
}
