'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, RefObject } from 'react'

export type Orientation = 'vertical' | 'horizontal'

type PropTypes = {
    scrollRef: RefObject<HTMLElement | null>
    orientation?: Orientation
    /** Placed on the track, so the caller decides where in its own box the indicator sits. */
    className?: string
    style?: CSSProperties
}

type Thumb = {
    startPercent: number
    sizePercent: number
}

type Drag = {
    pointerId: number
    startPointer: number
    startScroll: number
}

const axes = {
    vertical: { scroll: 'scrollTop', scrollSize: 'scrollHeight', clientSize: 'clientHeight', pointer: 'clientY' },
    horizontal: { scroll: 'scrollLeft', scrollSize: 'scrollWidth', clientSize: 'clientWidth', pointer: 'clientX' },
} as const

/**
 * An overlaid stand-in for a scrollbar, for containers whose native scrollbar is
 * hidden because its width would disturb the layout. Renders nothing while there
 * is nothing to scroll. Only the thumb takes pointer events, so it can be dragged
 * without the track blocking clicks on the content under it.
 *
 * Must be placed inside a positioned element that is not the scroll container
 * itself: absolute children of a scroller scroll away with its content.
 */
export default function ScrollIndicator({ scrollRef, orientation = 'vertical', className, style }: PropTypes) {
    const [thumb, setThumb] = useState<Thumb | null>(null)
    const [dragging, setDragging] = useState(false)
    const trackRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<Drag | null>(null)
    const axis = axes[orientation]

    useEffect(() => {
        const container = scrollRef.current
        if (!container) return undefined

        const measure = () => {
            const scroll = container[axis.scroll]
            const scrollSize = container[axis.scrollSize]
            const clientSize = container[axis.clientSize]
            if (scrollSize - clientSize < 1) {
                setThumb(null)
                return
            }
            setThumb({
                startPercent: (scroll / scrollSize) * 100,
                sizePercent: (clientSize / scrollSize) * 100,
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
    }, [scrollRef, axis])

    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
        const container = scrollRef.current
        if (!container || event.button !== 0) return
        // Stops the drag from selecting text on the way.
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
            pointerId: event.pointerId,
            startPointer: event[axis.pointer],
            startScroll: container[axis.scroll],
        }
        setDragging(true)
    }

    const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        const container = scrollRef.current
        const track = trackRef.current
        if (drag?.pointerId !== event.pointerId || !container || !track) return
        // The thumb spans the track the way the viewport spans the content, so this is the same ratio.
        const scrollPerPixel = container[axis.scrollSize] / track[axis.clientSize]
        container[axis.scroll] = drag.startScroll + (event[axis.pointer] - drag.startPointer) * scrollPerPixel
    }

    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return
        dragRef.current = null
        setDragging(false)
    }

    if (!thumb) return null

    const vertical = orientation === 'vertical'

    return (
        <div
            ref={trackRef}
            className={`
                absolute rounded-full pointer-events-none z-1
                ${vertical ? 'w-[3px]' : 'h-[3px]'}
                ${className ?? ''}
            `}
            style={style}
            data-dragging={dragging}
            aria-hidden="true"
        >
            <div
                className={`
                    absolute rounded-full bg-surface-subtle pointer-events-auto touch-none
                    before:absolute
                    ${vertical
            ? `
                inset-x-0 min-h-[12px]
                before:inset-y-0 before:-inset-x-[4px]
            `
            : `
                inset-y-0 min-w-[12px]
                before:inset-x-0 before:-inset-y-[4px]
            `}
                    ${dragging ? 'cursor-grabbing' : 'cursor-grab'}
                `}
                style={vertical
                    ? { top: `${thumb.startPercent}%`, height: `${thumb.sizePercent}%` }
                    : { left: `${thumb.startPercent}%`, width: `${thumb.sizePercent}%` }}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            />
        </div>
    )
}
