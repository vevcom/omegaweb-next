import '@pn-server-only'
import {
    DEFAULT_RELEASE_DATE,
    RELEASE_COUNTDOWN_GIT_GRAPH_FILE,
    RELEASE_COUNTDOWN_SETTINGS_FILE,
} from './constants'
import logger from '@/lib/logger'
import { storeBackend } from '@/lib/store/backend'
import { z } from 'zod'
import type { ReleaseCountdownSettings } from './types'
import type { GitGraph } from './gitGraph/types'

const settingsFileSchema = z.object({
    releaseDate: z.string().datetime({ offset: true }),
    openToAll: z.boolean(),
})

const defaultSettings = (): ReleaseCountdownSettings => ({
    releaseDate: DEFAULT_RELEASE_DATE,
    openToAll: false,
})

async function writeJsonFile(key: string, content: unknown) {
    await storeBackend.write(key, Buffer.from(JSON.stringify(content)))
}

/**
 * Whatever the file holds, for the schema to judge - a file that is not even JSON fails the schema
 * like any other wrong content, rather than throwing.
 */
function parseJson(raw: string): unknown {
    try {
        return JSON.parse(raw)
    } catch {
        return undefined
    }
}

export async function writeSettings(settings: ReleaseCountdownSettings) {
    await writeJsonFile(RELEASE_COUNTDOWN_SETTINGS_FILE, {
        releaseDate: settings.releaseDate.toISOString(),
        openToAll: settings.openToAll,
    })
}

/**
 * The settings in force. A missing file is created with the defaults, so that the first start of a
 * container leaves one behind to edit; an unreadable one is logged and left alone, and the
 * defaults are used until it is put right.
 */
export async function readSettings(): Promise<ReleaseCountdownSettings> {
    const raw = await storeBackend.read(RELEASE_COUNTDOWN_SETTINGS_FILE)
    if (raw === null) {
        const settings = defaultSettings()
        await writeSettings(settings)
        return settings
    }

    const parsed = settingsFileSchema.safeParse(parseJson(raw.toString('utf-8')))
    if (!parsed.success) {
        logger.warn('The release countdown settings file is not what was expected - using the defaults', {
            file: RELEASE_COUNTDOWN_SETTINGS_FILE,
            issues: parsed.error.issues,
        })
        return defaultSettings()
    }
    return {
        releaseDate: new Date(parsed.data.releaseDate),
        openToAll: parsed.data.openToAll,
    }
}

export async function writeGitGraph(graph: GitGraph) {
    await writeJsonFile(RELEASE_COUNTDOWN_GIT_GRAPH_FILE, graph)
}

export async function hasGitGraph(): Promise<boolean> {
    return await storeBackend.exists(RELEASE_COUNTDOWN_GIT_GRAPH_FILE)
}
