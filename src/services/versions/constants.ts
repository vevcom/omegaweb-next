import { resolve } from 'node:path'

export const versionsFileName = 'versions.json'

/** A version is named by its release tag, which also names its notes file, so it holds nothing a path reads. */
export const versionTagPattern = /^[A-Za-z0-9._-]+$/

export const notesFilePattern = /^[A-Za-z0-9._-]+\.md$/

export function versionsDirectory(): string {
    return process.env.VERSIONS_DIR ?? resolve(process.cwd(), 'versions')
}
