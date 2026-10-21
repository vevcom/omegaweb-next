import '@pn-server-only'
import { releaseCountdownAuth } from './auth'
import { releaseCountdownSchemas } from './schemas'
import { RELEASE_COUNTDOWN_COOKIE_NAME, RELEASE_COUNTDOWN_PASSWORD } from './constants'
import { readSettings, writeGitGraph, writeSettings } from './storage'
import { fetchGitGraph } from './gitGraph/fetch'
import { buildMockGitGraph } from './gitGraph/mock'
import { isUnlocked, safeEquals, unlockToken } from './access'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { cookies } from 'next/headers'
import type { ReleaseCountdownSettings } from './types'

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
        dataSchema: releaseCountdownSchemas.data.unlock,
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
        dataSchema: releaseCountdownSchemas.data.updateSettings,
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
        dataSchema: releaseCountdownSchemas.data.updateGitGraph,
        operation: async ({ data }) => {
            assertPassword(data.password)
            const graph = await fetchGitGraph()
            await writeGitGraph(graph)
            return { commits: graph.commits.length }
        }
    }),
    /**
     * Replaces the git graph the countdown plays with a made-up one, for when GitHub cannot be
     * reached.
     */
    mockGitGraph: defineOperation({
        authorizer: () => releaseCountdownAuth.mockGitGraph,
        dataSchema: releaseCountdownSchemas.data.mockGitGraph,
        operation: async ({ data }) => {
            assertPassword(data.password)
            const graph = buildMockGitGraph()
            await writeGitGraph(graph)
            return { commits: graph.commits.length }
        }
    }),
} as const
