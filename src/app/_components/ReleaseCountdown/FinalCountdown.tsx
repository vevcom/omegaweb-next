'use client'
import styles from './FinalCountdown.module.scss'
import { useState } from 'react'

const SECOND = 1000
const LAST_SECONDS = 10

type PropTypes = {
    remaining: number,
    duration: number,
}

/**
 * The last minute before the release, counted down in big numbers. It begins white, where the
 * white sun left the screen, and fades into its own color.
 */
export default function FinalCountdown({ remaining, duration }: PropTypes) {
    const seconds = Math.ceil(remaining / SECOND)
    // Only the first value is used, as in WhiteSun.
    const [fadeDelay] = useState(remaining - duration)

    return (
        <div className={`${styles.FinalCountdown} ${seconds <= LAST_SECONDS ? styles.lastSeconds : ''}`}>
            <h1 className={styles.title}>Project Next</h1>
            <div className={styles.stage} role="timer">
                {/* Keyed by the second, so their animations start over each second. */}
                <span key={`shockwave-${seconds}`} className={styles.shockwave} aria-hidden />
                <span key={seconds} className={styles.number}>{seconds}</span>
            </div>
            <div className={styles.whiteout} style={{ animationDelay: `${fadeDelay}ms` }} aria-hidden />
        </div>
    )
}
