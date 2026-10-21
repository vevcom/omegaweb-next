'use client'

import ScrollIndicator from './ScrollIndicator'
import { useRef } from 'react'
import type { ReactNode } from 'react'

type PropTypes = {
    className?: string
    scrollerClassName?: string
    children: ReactNode
}

export default function ScrollArea({ className, scrollerClassName, children }: PropTypes) {
    const scrollRef = useRef<HTMLDivElement>(null)

    return (
        <div className={`
            relative min-h-0
            ${className ?? ''}
        `}>
            <div ref={scrollRef} className={`
                h-full overflow-y-auto [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
                ${scrollerClassName ?? ''}
            `}>
                {children}
            </div>
            <ScrollIndicator scrollRef={scrollRef} className="top-(--rounding) bottom-(--rounding) right-1" />
        </div>
    )
}
