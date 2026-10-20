'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) {
            return undefined
        }

        const scriptUrl = process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw.js?cache=off'
        navigator.serviceWorker.register(scriptUrl).catch(() => {
            // Ignore registration failures (e.g. unsupported browsers).
        })

        // Only an update should reload. On a first-ever install clients.claim()
        // fires controllerchange too, and reloading there would bounce every new
        // visitor's very first page load.
        if (!navigator.serviceWorker.controller) {
            return undefined
        }

        // Reload once the new worker takes control so the new version is actually
        // used, then close the listener - it only needs to fire once.
        const handleControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
            window.location.reload()
        }
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

        return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }, [])

    return null
}
