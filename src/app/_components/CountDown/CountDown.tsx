'use client'

import { useEffect, useState } from 'react'

export default function CountDown({
    referenceDate,
}: {
    referenceDate: Date,
}) {
    const [time, setTime] = useState('')

    useEffect(() => {
        const intervalId = setInterval(() => {
            const diff = Math.abs(referenceDate.getTime() - (new Date()).getTime())
            let seconds = Math.floor(diff / 1000)
            let minutes = Math.floor(seconds / 60)
            let hours = Math.floor(minutes / 60)
            const days = Math.floor(hours / 24)

            seconds = seconds % 60
            minutes = minutes % 60
            hours = hours % 24

            if (days > 0) {
                setTime(`${days} dager`)
            } else if (hours > 0) {
                setTime(`${hours} timer ${minutes} minutter ${seconds} sekunder`)
            } else if (minutes > 0) {
                setTime(`${minutes} minutter ${seconds} sekunder`)
            } else if (seconds > 0) {
                setTime(`${seconds} sekunder`)
            }
        }, 100)


        return () => {
            clearInterval(intervalId)
        }
    })

    return <>{time}</>
}
