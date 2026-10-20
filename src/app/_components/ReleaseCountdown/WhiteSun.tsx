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
            className={styles.WhiteSun}
            style={{ '--rush-duration': `${duration}ms`, '--rush-delay': `${delay}ms` } as CSSProperties}
            aria-hidden
        >
            <div className={styles.rays}>
                <div className={styles.spin} />
            </div>
            <div className={styles.sun} />
            <div className={styles.whiteout} />
        </div>
    )
}
