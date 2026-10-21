'use client'
import styles from './WhiteSun.module.scss'
import { useState } from 'react'
import type { CSSProperties } from 'react'

type PropTypes = {
    // How far into the rush it is when this mounts, so a page loaded halfway joins in halfway.
    elapsed: number,
    duration: number,
}

// The point at the far end of the git graph that every part of the sun is centered on.
const sunCenterClassName = 'absolute left-1/2 top-[4%]'
const centeredClassName = 'absolute -translate-x-1/2 -translate-y-1/2'

/**
 * A white sun at the far end of the git graph that grows faster and faster during the rush, until
 * the screen is white when the final countdown begins. It shines from behind the graph, which runs
 * towards it, until its glare grows over the graph towards the end.
 */
export default function WhiteSun({ elapsed, duration }: PropTypes) {
    // Only the first value is used, since the animation runs by itself from there and a later
    // delay would skip it ahead.
    const [delay] = useState(-elapsed)
    const timing = { '--rush-duration': `${duration}ms`, '--rush-delay': `${delay}ms` } as CSSProperties

    return (
        <>
            <div className="absolute inset-0 -z-1 overflow-hidden pointer-events-none" style={timing} aria-hidden>
                <div className={sunCenterClassName}>
                    <div className={`
                        ${styles.grow}
                        ${centeredClassName}
                        size-[60vmax]
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
                        ${centeredClassName}
                        size-[24vmax] rounded-full
                        motion-reduce:hidden
                    `} />
                </div>
            </div>
            <div className="absolute inset-0 z-2 overflow-hidden pointer-events-none" style={timing} aria-hidden>
                <div className={sunCenterClassName}>
                    <div className={`
                        ${styles.grow}
                        ${centeredClassName}
                        size-[24vmax]
                        motion-reduce:hidden
                    `}>
                        <div className={`
                            ${styles.sun}
                            ${styles.glare}
                            size-full rounded-full
                        `} />
                    </div>
                </div>
                <div className={`
                    ${styles.whiteout}
                    absolute inset-0 bg-white
                `} />
            </div>
        </>
    )
}
