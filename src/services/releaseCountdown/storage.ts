import '@pn-server-only'
import {
    DEFAULT_RELEASE_DATE,
    RELEASE_COUNTDOWN_GIT_GRAPH_FILE,
    RELEASE_COUNTDOWN_SETTINGS_FILE,
    RELEASE_COUNTDOWN_STORE_DIRECTORY,
} from './constants'
import logger from '@/lib/logger'
import { z } from 'zod'
import { access, mkdir, readFile, rename, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
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

/**
 * Written to a temporary file and renamed into place, so a request that reads while another
 * writes sees either the old file or the new one, never half of the new one.
 */
async function writeJsonFile(path: string, content: unknown) {
    await mkdir(RELEASE_COUNTDOWN_STORE_DIRECTORY, { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(content))
    await rename(temporary, path)
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

function isMissingFile(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
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
    let raw: string
    try {
        raw = await readFile(RELEASE_COUNTDOWN_SETTINGS_FILE, 'utf-8')
    } catch (error) {
        if (!isMissingFile(error)) throw error
        const settings = defaultSettings()
        await writeSettings(settings)
        return settings
    }

    const parsed = settingsFileSchema.safeParse(parseJson(raw))
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
    try {
        await access(RELEASE_COUNTDOWN_GIT_GRAPH_FILE)
        return true
    } catch (error) {
        if (!isMissingFile(error)) throw error
        return false
    }
}
