'use client'
import { useEffect } from 'react'

export default function useInterval(callback: () => void | Promise<void>, interval: number) {
    useEffect(() => {
        const id = setInterval(() => void callback(), interval)
        return () => clearInterval(id)
    }, [callback, interval])
}
