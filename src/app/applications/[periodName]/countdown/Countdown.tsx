'use client'
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
        <div className="h-screen w-screen fixed top-0 left-0 flex flex-col items-center z-10 bg-black isolate">
            <div className="z-2">
                {!finalCountdown && (
                    <TimeLeft end={period.endDate} />
                )}
            </div>
            <div className="fixed w-screen h-screen z-1 top-0 left-0">
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
