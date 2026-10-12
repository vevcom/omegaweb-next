'use server'
import { releaseCountdownOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const unlockReleaseCountdownAction = makeAction(releaseCountdownOperations.unlock)
export const enterReleaseCountdownAction = makeAction(releaseCountdownOperations.enter)
export const updateReleaseCountdownSettingsAction = makeAction(releaseCountdownOperations.updateSettings)
export const updateReleaseCountdownGitGraphAction = makeAction(releaseCountdownOperations.updateGitGraph)
