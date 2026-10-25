'use client'
import { displayDate } from '@/lib/dates/displayDate'
import { useSyncExternalStore } from 'react'

type PropTypes = {
    date: Date
    includeTime?: boolean
}

/**
 * Just a wrapper for the displayDate function. Importantly it is client side rendered to use the client's timezone.
 * @param date - The date to display
 * @param includeTime - Whether to include time in the display
 * @returns the date in jsx
 */
const subscribeToNothing = () => () => {}

export default function Date({ date, includeTime = true }: PropTypes) {
    const isClient = useSyncExternalStore(subscribeToNothing, () => true, () => false)

    if (!isClient) {
        return `${date.toISOString().substring(0, includeTime ? 16 : 10)} (UTC)`
    }

    return displayDate(date, includeTime)
}
