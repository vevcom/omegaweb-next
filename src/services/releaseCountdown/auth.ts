import { Require } from '@/auth/authorizer/Require'

/**
 * Nothing here is gated by a session: whoever is on the countdown is not logged in. The writes
 * are gated by the release countdown password, which the operations check themselves.
 */
export const releaseCountdownAuth = {
    read: Require.nothing(),
    unlock: Require.nothing(),
    enter: Require.nothing(),
    updateSettings: Require.nothing(),
    updateGitGraph: Require.nothing(),
} as const
