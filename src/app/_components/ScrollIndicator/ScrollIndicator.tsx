'use client'

import styles from './ScrollIndicator.module.scss'
import { useEffect, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

type PropTypes = {
    scrollRef: RefObject<HTMLElement | null>
    /** Placed on the track, so the caller decides where in its own box the indicator sits. */
    className?: string
    style?: CSSProperties
}

type Thumb = {
    topPercent: number
    heightPercent: number
}

/**
 * An overlaid stand-in for a scrollbar, for containers whose native scrollbar is
 * hidden because its width would disturb the layout. Renders nothing while there
 * is nothing to scroll, and never takes pointer events - it can't be dragged.
 *
 * Must be placed inside a positioned element that is not the scroll container
 * itself: absolute children of a scroller scroll away with its content.
 */
export default function ScrollIndicator({ scrollRef, className, style }: PropTypes) {
    const [thumb, setThumb] = useState<Thumb | null>(null)

    useEffect(() => {
        const container = scrollRef.current
        if (!container) return undefined

        const measure = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            if (scrollHeight - clientHeight < 1) {
                setThumb(null)
                return
            }
            setThumb({
                topPercent: (scrollTop / scrollHeight) * 100,
                heightPercent: (clientHeight / scrollHeight) * 100,
            })
        }

        measure()
        container.addEventListener('scroll', measure, { passive: true })
        // Resizing changes how much fits, mutation how much there is. Both move the thumb.
        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(container)
        const mutationObserver = new MutationObserver(measure)
        mutationObserver.observe(container, { childList: true, subtree: true })

        return () => {
            container.removeEventListener('scroll', measure)
            resizeObserver.disconnect()
            mutationObserver.disconnect()
        }
    }, [scrollRef])

    if (!thumb) return null

    return (
        <div className={`${styles.ScrollIndicator} ${className ?? ''}`} style={style} aria-hidden="true">
            <div
                className={styles.thumb}
                style={{ top: `${thumb.topPercent}%`, height: `${thumb.heightPercent}%` }}
            />
        </div>
    )
}
