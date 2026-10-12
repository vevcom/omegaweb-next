import '@pn-server-only'
import { fetchGitGraph } from './gitGraph/fetch'
import { hasGitGraph, readSettings, writeGitGraph } from './storage'
import logger from '@/lib/logger'

/**
 * Run when the server starts: makes sure the settings file exists, and fetches the git graph if
 * there is none yet. The fetch is not waited for - it takes a while and the server can start
 * without it; the countdown simply plays no graph until it lands.
 */
export async function prepareReleaseCountdown() {
    await readSettings()

    if (await hasGitGraph()) return
    fetchGitGraph()
        .then(writeGitGraph)
        .catch(error => {
            logger.error('Could not fetch the git graph for the release countdown', { error })
        })
}
