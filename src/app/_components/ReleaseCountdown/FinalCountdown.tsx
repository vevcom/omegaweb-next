'use client'
import styles from './FinalCountdown.module.scss'
import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

const SECOND = 1000
const LAST_SECONDS = 10

type PropTypes = {
    remaining: number,
    duration: number,
}

/**
 * The last minute before the release, counted down in big numbers. It begins white, where the
 * white sun left the screen, and fades into its own color. At zero the title takes center stage and
 * reveals the new name: Project Next becomes Omegaweb Next.
 */
export default function FinalCountdown({ remaining, duration }: PropTypes) {
    const seconds = Math.ceil(remaining / SECOND)
    // Only the first value is used, as in WhiteSun.
    const [fadeDelay] = useState(remaining - duration)

    const lastSeconds = seconds <= LAST_SECONDS
    const revealing = remaining === 0
    const oldNameRef = useRef<HTMLSpanElement>(null)
    const newNameRef = useRef<HTMLSpanElement>(null)
    const [nameWidths, setNameWidths] = useState<CSSProperties>()

    // The names are measured in em, so the widths keep up as the title grows on its way to the center.
    useLayoutEffect(() => {
        if (!revealing || !oldNameRef.current || !newNameRef.current) return
        const widthOf = (name: HTMLElement) => `${name.offsetWidth / parseFloat(getComputedStyle(name).fontSize)}em`
        setNameWidths({
            '--old-name-width': widthOf(oldNameRef.current),
            '--new-name-width': widthOf(newNameRef.current),
        } as CSSProperties)
    }, [revealing])

    return (
        <div className={`
            ${styles.FinalCountdown}
            ${lastSeconds ? styles.lastSeconds : ''}
            absolute inset-0 flex items-center justify-center overflow-hidden text-white
        `}>
            <h1 className={`
                absolute m-0 font-secondary tracking-[0.08em] whitespace-nowrap
                transition-[top,translate,font-size,opacity] duration-[1.2s] ease-in-out
                motion-reduce:transition-none
                ${revealing ? 'top-1/2 -translate-y-1/2 text-[length:min(8rem,10vw)]' : 'top-6 text-xxl opacity-85'}
            `}>
                {revealing ? (
                    // The names share one cell, which goes from the width of the one to the other as they
                    // swap, so the title stays centered and Next moves over to make room.
                    <span className={`
                        ${styles.names}
                        inline-grid grid-cols-[minmax(0,1fr)] justify-items-end
                        [&>*]:[grid-area:1/1]
                    `} style={nameWidths}>
                        <span ref={oldNameRef} className={styles.oldName}>Project</span>
                        <span ref={newNameRef} className={styles.newName}>Omegaweb</span>
                    </span>
                ) : 'Project'} Next
            </h1>
            <div className={`
                grid place-items-center
                ${revealing ? 'hidden' : ''}
            `} role="timer">
                {/* Keyed by the second, so their animations start over each second. */}
                <span key={`shockwave-${seconds}`} className={`
                    ${styles.shockwave}
                    [grid-area:1/1] w-[min(50vh,46vw)] aspect-square rounded-full border-white/60
                    ${lastSeconds ? 'border-[0.8rem]' : 'border-[0.4rem]'}
                `} aria-hidden />
                <span key={seconds} className={`
                    ${styles.number}
                    [grid-area:1/1] text-[length:min(62vh,58vw)] font-bold tabular-nums leading-none tracking-[-0.04em]
                `}>{seconds}</span>
            </div>
            <div
                className={`
                    ${styles.whiteout}
                    absolute inset-0 bg-white pointer-events-none
                `}
                style={{ animationDelay: `${fadeDelay}ms` }}
                aria-hidden
            />
        </div>
    )
}
