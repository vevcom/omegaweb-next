import '@pn-server-only'
import { RELEASE_COUNTDOWN_COOKIE_NAME, RELEASE_COUNTDOWN_PASSWORD } from './constants'
import { readSettings } from './storage'
import { cookies } from 'next/headers'
import { unstable_rethrow as unstableRethrow } from 'next/navigation'
import { createHash, timingSafeEqual } from 'crypto'
import type { ReleaseCountdownSettings } from './types'

/**
 * The cookie stores a hash rather than a plain flag, so it cannot be forged without knowing the
 * password, and changing the password invalidates all existing cookies. There is one token for
 * those who gave the password, and one for those who were let in because the countdown was open
 * to all - so that closing it again shuts the latter out, and only them.
 */
export function unlockToken(kind: 'admin' | 'public') {
    return createHash('sha256')
        .update(`${RELEASE_COUNTDOWN_COOKIE_NAME}:${kind}:${RELEASE_COUNTDOWN_PASSWORD ?? ''}`)
        .digest('hex')
}

export function safeEquals(first: string, second: string) {
    const firstBuffer = Buffer.from(first)
    const secondBuffer = Buffer.from(second)
    return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer)
}

export async function isUnlocked(settings: ReleaseCountdownSettings) {
    const cookie = (await cookies()).get(RELEASE_COUNTDOWN_COOKIE_NAME)
    if (!cookie) return false
    if (RELEASE_COUNTDOWN_PASSWORD && safeEquals(cookie.value, unlockToken('admin'))) return true
    return settings.openToAll && safeEquals(cookie.value, unlockToken('public'))
}

/**
 * Whether the countdown keeps the request from the service layer: it is not released yet and the
 * visitor has not been let past it. The website behind the countdown is not only hidden, so its
 * actions, API and page data cannot be reached around it. The countdown's own operations are what
 * it is run through, so they are never held back.
 *
 * @param operation - The operation about to run, if the request is for one.
 */
export async function releaseCountdownHoldsBack(operation?: unknown) {
    const { releaseCountdownOperations } = await import('./operations')
    if (Object.values(releaseCountdownOperations).some(countdownOperation => countdownOperation === operation)) {
        return false
    }
    if (!await isRequest()) return false

    const settings = await readSettings()
    return Date.now() < settings.releaseDate.getTime() && !await isUnlocked(settings)
}

/**
 * Workers, seeders and tests call operations outside any request. That is the server's own work,
 * which the countdown does not hold back, and Next.js tells it apart by `cookies` throwing.
 */
async function isRequest() {
    try {
        await cookies()
        return true
    } catch (error) {
        unstableRethrow(error)
        return false
    }
}
