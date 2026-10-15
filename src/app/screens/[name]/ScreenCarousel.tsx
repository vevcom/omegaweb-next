'use client'
import styles from './ScreenCarousel.module.scss'
import { useRouter } from 'next/navigation'
import { Children, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// How long each page is shown.
const pageIntervalMs = 15 * 1000
// How often the screen reloads its pages, so a display picks up changes without anyone touching it.
const refreshIntervalMs = 5 * 60 * 1000

/** Shows one child at a time, moving to the next every pageIntervalMs. */
export default function ScreenCarousel({ children }: { children: ReactNode }) {
    const slides = Children.toArray(children)
    const [current, setCurrent] = useState(0)
    const { refresh } = useRouter()

    useEffect(() => {
        if (slides.length < 2) return undefined
        const timer = setInterval(() => setCurrent(index => index + 1), pageIntervalMs)
        return () => clearInterval(timer)
    }, [slides.length])

    useEffect(() => {
        const timer = setInterval(refresh, refreshIntervalMs)
        return () => clearInterval(timer)
    }, [refresh])

    if (slides.length === 0) return <p>Denne skjermen viser ingen sider ennå.</p>

    // Taken modulo here rather than when advancing, so a refresh that removes pages stays in range.
    const shown = current % slides.length
    return (
        <div className={styles.ScreenCarousel}>
            {slides.map((slide, index) => (
                <div key={index} className={styles.slide} hidden={index !== shown}>{slide}</div>
            ))}
        </div>
    )
}
