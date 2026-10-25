import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// The not-found page has no metadata of its own; the title comes from here.
export const metadata: Metadata = {
    title: 'Side ikke funnet',
}

/**
 * Catches every url no route matches, so that the 404 page renders inside Omega's layout: the
 * root layout has no navigation of its own, and a not-found page there would stand bare.
 */
export default function NotFoundCatchAll() {
    notFound()
}
