'use client'

import ScrollIndicator from './ScrollIndicator'
import { useRef } from 'react'
import type { Orientation } from './ScrollIndicator'
import type { ReactNode } from 'react'

type PropTypes = {
    className?: string
    scrollerClassName?: string
    orientation?: Orientation
    children: ReactNode
}

export default function ScrollArea({ className, scrollerClassName, orientation = 'vertical', children }: PropTypes) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const vertical = orientation === 'vertical'

    return (
        <div className={`
            relative min-h-0
            ${className ?? ''}
        `}>
            {/* Rounded so that content cut off at its edges keeps rounded corners. */}
            <div ref={scrollRef} className={`
                rounded-round [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
                ${vertical ? 'h-full overflow-y-auto' : 'overflow-x-auto'}
                ${scrollerClassName ?? ''}
            `}>
                {children}
            </div>
            <ScrollIndicator
                scrollRef={scrollRef}
                orientation={orientation}
                className={vertical
                    ? 'top-(--rounding) bottom-(--rounding) right-1'
                    : 'left-(--rounding) right-(--rounding) bottom-0'}
            />
        </div>
    )
}
