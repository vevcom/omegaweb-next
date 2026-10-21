'use client'
import styles from './WhiteSun.module.scss'
import { useState } from 'react'
import type { CSSProperties } from 'react'

type PropTypes = {
    // How far into the rush it is when this mounts, so a page loaded halfway joins in halfway.
    elapsed: number,
    duration: number,
}

/**
 * A white sun at the far end of the git graph that grows faster and faster during the rush, until
 * the screen is white when the final countdown begins.
 */
export default function WhiteSun({ elapsed, duration }: PropTypes) {
    // Only the first value is used, since the animation runs by itself from there and a later
    // delay would skip it ahead.
    const [delay] = useState(-elapsed)

    return (
        <div
            className="absolute inset-0 z-2 overflow-hidden pointer-events-none"
            style={{ '--rush-duration': `${duration}ms`, '--rush-delay': `${delay}ms` } as CSSProperties}
            aria-hidden
        >
            <div className={`
                ${styles.grow}
                absolute left-[calc(50%-30vmax)] top-[calc(12%-30vmax)] size-[60vmax]
                motion-reduce:hidden
            `}>
                <div className={`
                    ${styles.spin}
                    size-full rounded-full [mask-image:radial-gradient(circle,black_10%,transparent_70%)]
                    bg-[repeating-conic-gradient(rgb(255_250_235/22%)_0deg_3deg,transparent_3deg_15deg)]
                `} />
            </div>
            <div className={`
                ${styles.grow}
                ${styles.sun}
                absolute left-[calc(50%-12vmax)] top-[calc(12%-12vmax)] size-[24vmax] rounded-full
                motion-reduce:hidden
            `} />
            <div className={`
                ${styles.whiteout}
                absolute inset-0 bg-white
            `} />
        </div>
    )
}
