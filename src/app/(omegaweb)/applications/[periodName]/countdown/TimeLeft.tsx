'use client'
import styles from './TimeLeft.module.scss'
import useInterval from '@/hooks/useInterval'
import { useMemo, useState } from 'react'

type PropTypes = {
    end: Date
}

const getTimeLeftGen = (end: Date) => () => {
    const seconds = Math.round((end.getTime() - Date.now()) / 1000)
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return { days, hours, minutes, secs }
}

export default function TimeLeft({ end }: PropTypes) {
    const getTimeLeft = useMemo(() => getTimeLeftGen(end), [end])
    const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft> | null>(null)
    useInterval(() => {
        setTimeLeft(getTimeLeft())
    }, 100)

    if (!timeLeft) return null
    if (timeLeft.secs < 0) return null
    return (
        <div className={styles.Countdown}>
            {timeLeft.days > 0 && (
                <>
                    <div>{String(timeLeft.days).padStart(2, '0')}</div>
                    <span>:</span>
                </>
            )}
            {timeLeft.hours > 0 && (
                <>
                    <div>{String(timeLeft.hours).padStart(2, '0')}</div>
                    <span>:</span>
                </>
            )}
            {timeLeft.minutes > 0 && (
                <>
                    <div>{String(timeLeft.minutes).padStart(2, '0')}</div>
                    <span>:</span>
                </>
            )}
            <div>{String(timeLeft.secs).padStart(2, '0')}</div>
        </div>
    )
}
