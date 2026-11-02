import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// The not-found page has no metadata of its own; the title comes from here. Absolute, as the
// group's template does not reach a not-found page and Omega's would be applied instead.
export const metadata: Metadata = {
    title: { absolute: 'Fant ikke siden | Omegarevyen' },
}

/** Catches the urls under /revue no route matches, so that the 404 page renders inside the revue layout. */
export default function NotFoundCatchAll() {
    notFound()
}
