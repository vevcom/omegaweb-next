'use client'
import canvasConfetti from 'canvas-confetti'
import { useEffect, useEffectEvent } from 'react'

type PropTypes = {
    angle?: number,
    spread?: number,
    duration?: number,
    colors?: string[],
    particleCount?: number,
    origin?: { x: number, y: number },
}

/**
 * Fires confetti for `duration` milliseconds when it mounts. Renders nothing.
 */
export default function Confetti({
    angle = 90,
    spread = 150,
    duration = 1000,
    colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'],
    particleCount = 10,
    origin = { x: 0.5, y: 1 },
}: PropTypes) {
    const fire = useEffectEvent(() => {
        const end = Date.now() + duration
        let frameId = 0

        const frame = () => {
            canvasConfetti({ particleCount, angle, spread, origin, colors })
            if (Date.now() < end) {
                frameId = requestAnimationFrame(frame)
            }
        }
        frame()

        return () => cancelAnimationFrame(frameId)
    })

    useEffect(() => fire(), [])

    return null
}
