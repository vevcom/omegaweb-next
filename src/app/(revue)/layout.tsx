import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
    title: {
        default: 'Omegarevyen',
        template: '%s | Omegarevyen',
    },
    description: 'Omegarevyen, revyen til linjeforeningen Omega ved NTNU.',
}

/**
 * The revue pages as their own site inside Omega's, like the career pages. Their shell is `RevueShell`,
 * mounted twice: by the layout of /revue/[year] with the revue's own theme, and by the one of
 * (static-theme) with the static theme for every other page. A page has one of them and never both,
 * so it has one theme and one theme-color.
 */
export default function RevueLayout({ children }: { children: ReactNode }) {
    return children
}
