'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, RefObject } from 'react'

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

type Drag = {
    pointerId: number
    startY: number
    startScrollTop: number
}

/**
 * An overlaid stand-in for a scrollbar, for containers whose native scrollbar is
 * hidden because its width would disturb the layout. Renders nothing while there
 * is nothing to scroll. Only the thumb takes pointer events, so it can be dragged
 * without the track blocking clicks on the content under it.
 *
 * Must be placed inside a positioned element that is not the scroll container
 * itself: absolute children of a scroller scroll away with its content.
 */
export default function ScrollIndicator({ scrollRef, className, style }: PropTypes) {
    const [thumb, setThumb] = useState<Thumb | null>(null)
    const [dragging, setDragging] = useState(false)
    const trackRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<Drag | null>(null)

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

    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
        const container = scrollRef.current
        if (!container || event.button !== 0) return
        // Stops the drag from selecting text on the way.
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startScrollTop: container.scrollTop,
        }
        setDragging(true)
    }

    const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        const container = scrollRef.current
        const track = trackRef.current
        if (!drag || drag.pointerId !== event.pointerId || !container || !track) return
        // The thumb spans the track the way the viewport spans the content, so this is the same ratio.
        const scrollPerPixel = container.scrollHeight / track.clientHeight
        container.scrollTop = drag.startScrollTop + (event.clientY - drag.startY) * scrollPerPixel
    }

    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return
        dragRef.current = null
        setDragging(false)
    }

    if (!thumb) return null

    return (
        <div
            ref={trackRef}
            className={`absolute w-[3px] rounded-full pointer-events-none z-1 ${className ?? ''}`}
            style={style}
            data-dragging={dragging}
            aria-hidden="true"
        >
            <div
                className={[
                    'absolute inset-x-0 min-h-[12px] rounded-full bg-surface-subtle pointer-events-auto touch-none before:absolute before:inset-y-0 before:-inset-x-[4px]',
                    dragging ? 'cursor-grabbing' : 'cursor-grab',
                ].join(' ')}
                style={{ top: `${thumb.topPercent}%`, height: `${thumb.heightPercent}%` }}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            />
        </div>
    )
}
