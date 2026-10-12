import '@pn-server-only'
import { releaseCountdownAuth } from './auth'
import { releaseCountdownSchemas } from './schemas'
import { RELEASE_COUNTDOWN_COOKIE_NAME, RELEASE_COUNTDOWN_PASSWORD } from './constants'
import { readSettings, writeGitGraph, writeSettings } from './storage'
import { fetchGitGraph } from './gitGraph/fetch'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'crypto'
import type { ReleaseCountdownSettings } from './types'

/**
 * The cookie stores a hash rather than a plain flag, so it cannot be forged without knowing the
 * password, and changing the password invalidates all existing cookies. There is one token for
 * those who gave the password, and one for those who were let in because the countdown was open
 * to all - so that closing it again shuts the latter out, and only them.
 */
function unlockToken(kind: 'admin' | 'public') {
    return createHash('sha256')
        .update(`${RELEASE_COUNTDOWN_COOKIE_NAME}:${kind}:${RELEASE_COUNTDOWN_PASSWORD ?? ''}`)
        .digest('hex')
}

function safeEquals(first: string, second: string) {
    const firstBuffer = Buffer.from(first)
    const secondBuffer = Buffer.from(second)
    return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer)
}

function assertPassword(password: string) {
    if (!RELEASE_COUNTDOWN_PASSWORD) {
        throw new ServiceError('INVALID CONFIGURATION', 'Det er ikke satt noe passord for nedtellingen')
    }
    if (!safeEquals(password, RELEASE_COUNTDOWN_PASSWORD)) {
        throw new ServiceError('BAD DATA', [{ path: ['password'], message: 'Feil passord' }])
    }
}

/**
 * An admin stays in until the release. Someone let in because the countdown was open to all is in
 * for the browser session only, so the next time they come by they are played the countdown and
 * the git graph again.
 */
async function setUnlockCookie(kind: 'admin' | 'public', settings: ReleaseCountdownSettings) {
    const cookieStore = await cookies()
    cookieStore.set(RELEASE_COUNTDOWN_COOKIE_NAME, unlockToken(kind), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        ...(kind === 'admin' ? { expires: settings.releaseDate } : {}),
    })
}

async function isUnlocked(settings: ReleaseCountdownSettings) {
    const cookie = (await cookies()).get(RELEASE_COUNTDOWN_COOKIE_NAME)
    if (!cookie) return false
    if (RELEASE_COUNTDOWN_PASSWORD && safeEquals(cookie.value, unlockToken('admin'))) return true
    return settings.openToAll && safeEquals(cookie.value, unlockToken('public'))
}

export const releaseCountdownOperations = {
    /**
     * Whether the countdown should be shown instead of the website, and what it should show.
     */
    read: defineOperation({
        authorizer: () => releaseCountdownAuth.read,
        operation: async (): Promise<ReleaseCountdownSettings & { active: boolean }> => {
            const settings = await readSettings()
            const released = Date.now() >= settings.releaseDate.getTime()
            return {
                ...settings,
                active: !released && !await isUnlocked(settings),
            }
        }
    }),
    /**
     * Lets whoever gives the password past the countdown.
     */
    unlock: defineOperation({
        authorizer: () => releaseCountdownAuth.unlock,
        dataSchema: releaseCountdownSchemas.unlock,
        operation: async ({ data }) => {
            assertPassword(data.password)
            await setUnlockCookie('admin', await readSettings())
        }
    }),
    /**
     * Lets anyone past the countdown, as long as it is open to all.
     */
    enter: defineOperation({
        authorizer: () => releaseCountdownAuth.enter,
        operation: async () => {
            const settings = await readSettings()
            if (!settings.openToAll) {
                throw new ServiceError('BAD DATA', 'Nettsiden er ikke åpnet for alle ennå')
            }
            await setUnlockCookie('public', settings)
        }
    }),
    updateSettings: defineOperation({
        authorizer: () => releaseCountdownAuth.updateSettings,
        dataSchema: releaseCountdownSchemas.updateSettings,
        operation: async ({ data }) => {
            assertPassword(data.password)
            await writeSettings({
                releaseDate: data.releaseDate,
                openToAll: data.openToAll,
            })
        }
    }),
    /**
     * Fetches the history anew from GitHub and replaces the git graph the countdown plays.
     */
    updateGitGraph: defineOperation({
        authorizer: () => releaseCountdownAuth.updateGitGraph,
        dataSchema: releaseCountdownSchemas.updateGitGraph,
        operation: async ({ data }) => {
            assertPassword(data.password)
            const graph = await fetchGitGraph()
            await writeGitGraph(graph)
            return { commits: graph.commits.length }
        }
    }),
} as const
