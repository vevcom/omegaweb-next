import styles from './Requirements.module.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { OmegaOrderRequirement } from '@/services/omegaOrder/types'

type PropTypes = {
    requirements: OmegaOrderRequirement[]
}

/**
 * The conditions that must hold before omega can be incremented, each with a check or a cross
 * depending on whether it is met.
 */
export default function Requirements({ requirements }: PropTypes) {
    const fulfilledCount = requirements.filter(requirement => requirement.fulfilled).length
    const allFulfilled = fulfilledCount === requirements.length

    return (
        <div className={styles.Requirements}>
            <div className={styles.header}>
                <p>For å kunne opprette neste orden må følgende ha skjedd:</p>
                <span className={allFulfilled ? styles.fulfilled : styles.unfulfilled}>
                    {fulfilledCount} / {requirements.length}
                </span>
            </div>
            <ul>
                {requirements.map(requirement => (
                    <li
                        key={requirement.key}
                        className={requirement.fulfilled ? styles.fulfilled : styles.unfulfilled}
                    >
                        <FontAwesomeIcon icon={requirement.fulfilled ? faCheck : faXmark} />
                        <span>{requirement.description}</span>
                        {requirement.detail && <i className={styles.detail}>{requirement.detail}</i>}
                    </li>
                ))}
            </ul>
        </div>
    )
}
