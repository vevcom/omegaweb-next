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

    const lastSeconds = seconds <= LAST_SECONDS

    return (
        <div className={[
            styles.FinalCountdown,
            lastSeconds ? styles.lastSeconds : '',
            'absolute inset-0 flex items-center justify-center overflow-hidden text-white',
        ].join(' ')}>
            <h1 className="absolute top-6 m-0 font-secondary text-xxl tracking-[0.08em] opacity-85">Project Next</h1>
            <div className="grid place-items-center" role="timer">
                {/* Keyed by the second, so their animations start over each second. */}
                <span key={`shockwave-${seconds}`} className={[
                    styles.shockwave,
                    '[grid-area:1/1] w-[min(50vh,46vw)] aspect-square rounded-full border-white/60',
                    lastSeconds ? 'border-[0.8rem]' : 'border-[0.4rem]',
                ].join(' ')} aria-hidden />
                <span key={seconds} className={[
                    styles.number,
                    '[grid-area:1/1] text-[length:min(62vh,58vw)] font-bold tabular-nums leading-none tracking-[-0.04em]',
                ].join(' ')}>{seconds}</span>
            </div>
            <div
                className={`${styles.whiteout} absolute inset-0 bg-white pointer-events-none`}
                style={{ animationDelay: `${fadeDelay}ms` }}
                aria-hidden
            />
        </div>
    )
}
