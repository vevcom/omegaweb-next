'use client'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type PropTypes = {
    children: ReactNode
    direction?: 'left' | 'right' | 'top' | 'bottom'
}

const directionClassNames = {
    bottom: 'translate-y-1',
    top: '-translate-y-1',
    left: '-translate-x-1',
    right: 'translate-x-1',
}

export default function SlideInOnView({ children, direction = 'bottom' }: PropTypes) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    ref.current?.classList.add('visible')
                }
            },
            {
                threshold: 0.1,
            }
        )

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current)
            }
        }
    }, [])

    return (
        <div ref={ref} className={`
            opacity-0 [transition:opacity_1s,translate_0.6s]
            [&.visible]:opacity-100 [&.visible]:translate-none
            ${directionClassNames[direction]}
        `}>
            {children}
        </div>
    )
}
