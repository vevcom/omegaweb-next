import ReleaseCountdown from './ReleaseCountdown'
import { releaseCountdownOperations } from '@/services/releaseCountdown/operations'
import { DEFAULT_RELEASE_DATE } from '@/services/releaseCountdown/constants'
import { withFallback, withPageSession } from '@/app/ServerPage'
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
    const releaseCountdown = await readReleaseCountdown()

    if (!releaseCountdown.active) return children

    return (
        <ReleaseCountdown
            releaseDate={releaseCountdown.releaseDate.getTime()}
            openToAll={releaseCountdown.openToAll}
        />
    )
}

/**
 * When the read fails, the default release date decides, so the site is neither leaked before
 * release nor hidden behind the countdown after it.
 */
function readReleaseCountdown() {
    return withPageSession(() => withFallback(
        releaseCountdownOperations.read({}),
        {
            active: Date.now() < DEFAULT_RELEASE_DATE.getTime(),
            releaseDate: DEFAULT_RELEASE_DATE,
            openToAll: false,
        },
    ))
}
