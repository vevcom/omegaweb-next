/**
 * The release moment the countdown starts out with. The one in use is read from the settings file
 * and can be changed from the admin panel on the countdown (press space).
 */
export const DEFAULT_RELEASE_DATE = new Date('2026-10-23T22:00:00+02:00')

export const RELEASE_COUNTDOWN_COOKIE_NAME = 'release-countdown-unlock'

export const RELEASE_COUNTDOWN_PASSWORD = process.env.RELEASE_COUNTDOWN_PASSWORD

/**
 * The countdown keeps its state in files rather than the database, so it works before the
 * database is migrated and seeded, and so nothing of it has to be cleaned up after release.
 * They live in the store, which is the volume that outlives the container. The settings file is
 * created on startup (see `prepare.ts`) and the git graph fetched from GitHub when missing.
 */
export const RELEASE_COUNTDOWN_STORE_DIRECTORY = 'store/releaseCountdown'
export const RELEASE_COUNTDOWN_SETTINGS_FILE = `${RELEASE_COUNTDOWN_STORE_DIRECTORY}/settings.json`
export const RELEASE_COUNTDOWN_GIT_GRAPH_FILE = `${RELEASE_COUNTDOWN_STORE_DIRECTORY}/gitGraph.json`
/**
 * Where the client fetches the git graph from: the store is served as is.
 */
export const RELEASE_COUNTDOWN_GIT_GRAPH_URL = '/store/releaseCountdown/gitGraph.json'

export const GIT_GRAPH_REPOSITORY = { owner: 'vevcom', name: 'project-next', branch: 'main' } as const
export const GIT_GRAPH_REPOSITORY_URL = `https://github.com/${GIT_GRAPH_REPOSITORY.owner}/${GIT_GRAPH_REPOSITORY.name}`
/**
 * Optional. Without it GitHub allows 60 requests an hour per address, and the history takes about
 * one request per hundred commits, so updating the graph more than once an hour needs a token.
 */
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN
