'use client'
import { useEffect } from 'react'
import type { Awaitable } from '@/lib/awaitable'

export default function useInterval(callback: () => Awaitable<void>, interval: number) {
    useEffect(() => {
        const id = setInterval(() => void callback(), interval)
        return () => clearInterval(id)
    }, [callback, interval])
}
