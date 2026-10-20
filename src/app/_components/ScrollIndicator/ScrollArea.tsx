'use client'

import styles from './ScrollArea.module.scss'
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
        <div className={`${styles.ScrollArea} ${className ?? ''}`}>
            <div ref={scrollRef} className={`${styles.scroller} ${scrollerClassName ?? ''}`}>
                {children}
            </div>
            <ScrollIndicator scrollRef={scrollRef} className={styles.indicator} />
        </div>
    )
}
