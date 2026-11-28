import '@ow-server-only'
import { versionsAuth } from './auth'
import { versionsDirectory, versionsFileName, versionTagPattern } from './constants'
import { versionsFileSchema, versionsSchemas } from './schemas'
import { Smorekopp } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { markdownToSafeHtml } from '@/lib/html/safeHtml'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BakedVersions } from './types'

const bake = defineSubOperation({
    paramsSchema: () => versionsSchemas.params.bake,
    dataSchema: () => versionsSchemas.data.bake,
    read: false,
    operation: () => async ({ params, data }) => {
        const releases = data.releases.filter(release => release.published_at !== null && (
            release.tag_name === data.currentTag
            || (!release.draft && !release.prerelease && versionTagPattern.test(release.tag_name))
        ))
        if (!releases.some(release => release.tag_name === data.currentTag)) {
            throw new Smorekopp('NOT FOUND', `No published release is tagged ${data.currentTag}`)
        }

        const versionsFile = versionsFileSchema.parse({
            repositoryUrl: data.repositoryUrl,
            versions: releases.map(release => ({
                version: release.tag_name,
                name: release.name || release.tag_name,
                releasedAt: release.published_at,
                notesFile: `${release.tag_name}.md`,
                current: release.tag_name === data.currentTag,
            })),
        })

        await mkdir(params.directory, { recursive: true })
        await Promise.all(releases.map(release => writeFile(
            join(params.directory, `${release.tag_name}.md`),
            (release.body ?? '').replaceAll('\r\n', '\n'),
        )))
        await writeFile(join(params.directory, versionsFileName), `${JSON.stringify(versionsFile, null, 4)}\n`)
        return versionsFile
    },
})

export const versionsOperations = {
    readCurrent: defineOperation({
        authorizer: () => versionsAuth.readCurrent,
        read: true,
        operation: async () => {
            const { versions } = await readVersions(versionsDirectory())
            const current = versions.find(version => version.current)
            return current ? { version: current.version, name: current.name, releasedAt: current.releasedAt } : null
        },
    }),
    readAll: defineOperation({
        authorizer: () => versionsAuth.readAll,
        read: true,
        operation: async () => {
            const directory = versionsDirectory()
            const { versions } = await readVersions(directory)
            return Promise.all(versions.map(async ({ notesFile, ...version }) => ({
                ...version,
                notesHtml: await markdownToSafeHtml(await readFile(join(directory, notesFile), 'utf8'), { gfm: true }),
            })))
        },
    }),
    readRepositoryUrl: defineOperation({
        authorizer: () => versionsAuth.readRepositoryUrl,
        read: true,
        operation: async () => (await readVersions(versionsDirectory())).repositoryUrl,
    }),
    internal: {
        bake,
    },
} as const

const versionsOfDirectory = new Map<string, Promise<BakedVersions>>()

/** An image never changes its versions, so each directory is read once. */
function readVersions(directory: string): Promise<BakedVersions> {
    const cached = versionsOfDirectory.get(directory)
    if (cached) return cached
    const read = readVersionsFile(directory)
    versionsOfDirectory.set(directory, read)
    read.catch(() => versionsOfDirectory.delete(directory))
    return read
}

async function readVersionsFile(directory: string): Promise<BakedVersions> {
    const file = join(directory, versionsFileName)
    if (!existsSync(file)) return { repositoryUrl: null, versions: [] }

    const { repositoryUrl, versions } = versionsFileSchema.parse(JSON.parse(await readFile(file, 'utf8')))
    return {
        repositoryUrl,
        versions: versions
            .map(version => ({ ...version, releasedAt: new Date(version.releasedAt) }))
            .toSorted((first, second) => second.releasedAt.getTime() - first.releasedAt.getTime()),
    }
}
