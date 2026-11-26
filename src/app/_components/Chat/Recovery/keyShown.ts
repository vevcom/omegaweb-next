import { RecoveryIsSetUp, RecoveryUnfinished } from '@/lib/chatSession/recovery'

/**
 * The recovery key the page shows for the user to save. One whose setting up is not finished is
 * shown all the same, since it may be the account's already. `isLetGo` says that such a key was
 * shown and turned out never to become the account's, so the user is told not to keep it.
 */
export type KeyShown = {
    made: { recoveryKey: string, isSetUp: boolean } | null,
    isLetGo: boolean,
}

export const NO_KEY_SHOWN: KeyShown = { made: null, isLetGo: false }

/** What is shown once a setting up has given a key or has rejected, from what was shown before it. */
export function keyShownAfter(before: KeyShown, outcome: { recoveryKey: string } | { error: unknown }): KeyShown {
    if ('recoveryKey' in outcome) return { made: { recoveryKey: outcome.recoveryKey, isSetUp: true }, isLetGo: false }
    const { error } = outcome
    if (error instanceof RecoveryUnfinished) {
        return { made: { recoveryKey: error.recoveryKey, isSetUp: false }, isLetGo: false }
    }
    // The account has a key that is another's making, so the one shown here is no key to save.
    if (error instanceof RecoveryIsSetUp) return { made: null, isLetGo: before.made !== null }
    return before
}
