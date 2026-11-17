'use client'
import { implementVisibilityComponents } from '@/components/Visibility/VisibilityComponents'

/** A quota without requirements still takes a user to register. */
export const eventQuotaVisibility = implementVisibilityComponents({
    verb: 'kan melde seg på',
    everyone: 'Alle som er logget inn',
})

// Saved with the rest of the event's setup, so it has no update action of its own.
export const eventAdminVisibility = implementVisibilityComponents({ verb: 'kan administrere arrangementet' })
