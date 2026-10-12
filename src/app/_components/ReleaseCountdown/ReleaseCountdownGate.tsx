import ReleaseCountdown from './ReleaseCountdown'
import { releaseCountdownOperations } from '@/services/releaseCountdown/operations'
import { DEFAULT_RELEASE_DATE } from '@/services/releaseCountdown/constants'
import { withFallback, withPageSession } from '@/app/serverPage'
import type { ReactNode } from 'react'

type PropTypes = {
    children: ReactNode,
}

/**
 * Shows the release countdown instead of the website until it is released or the visitor has been
 * let past it. The root layout wraps the website in this and nothing else of the countdown, so
 * that removing it after release is a matter of unwrapping - see TEARDOWN.md in the service.
 */
export default async function ReleaseCountdownGate({ children }: PropTypes) {
    // Shown rather than hidden when the read fails: the countdown must not leak the site before
    // release.
    const releaseCountdown = await withPageSession(() => withFallback(
        releaseCountdownOperations.read({}),
        { active: true, releaseDate: DEFAULT_RELEASE_DATE, openToAll: false },
    ))

    if (!releaseCountdown.active) return children

    return (
        <ReleaseCountdown
            releaseDate={releaseCountdown.releaseDate.getTime()}
            openToAll={releaseCountdown.openToAll}
        />
    )
}
