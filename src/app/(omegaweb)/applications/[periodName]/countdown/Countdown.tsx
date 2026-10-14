'use client'
import styles from './Countdown.module.scss'
import TimeLeft from './TimeLeft'
import CommitteeLogoRoll from './CommitteeLogoRoll'
import Speedlines from './Speedlines'
import FinalCountdown from './FinalCountdown'
import useInterval from '@/hooks/useInterval'
import { useState } from 'react'
import type { ExpandedApplicationPeriod } from '@/services/applications/periods/types'

type PropTypes = {
    period: ExpandedApplicationPeriod
}

export default function Countdown({ period }: PropTypes) {
    const [showCommitteeRoll, setShowComitteeRoll] = useState(true)
    const [finalCountdown, setFinalCountdown] = useState(false)

    useInterval(() => {
        if (new Date().getTime() + 20_000 > period.endDate.getTime()) {
            setShowComitteeRoll(false)
            setTimeout(() => {
                setFinalCountdown(true)
            }, Math.max(0, period.endDate.getTime() - new Date().getTime() - 12_000))
        }
    }, 10_000)

    return (
        <div className={styles.Countdown}>
            <div className={styles.top}>
                {!finalCountdown && (
                    <TimeLeft end={period.endDate} />
                )}
            </div>
            <div className={styles.under}>
                <Speedlines />
                {showCommitteeRoll && (
                    <CommitteeLogoRoll periodName={period.name} committees={period.committeesParticipating.map(part => ({
                        shortName: part.committee.shortName,
                        logo: part.committee.logoImage
                    }))} />
                )}
                {finalCountdown && (
                    <FinalCountdown periodName={period.name} />
                )}
            </div>
        </div>
    )
}
