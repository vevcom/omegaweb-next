import { versionsOperations } from '@/services/versions/operations'
import { Smorekopp } from '@/services/error'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GithubRelease } from '@/services/versions/types'

const repositoryUrl = 'https://github.com/vevcom/omegaweb-next'

function release(tag: string, publishedAt: string, overrides: Partial<GithubRelease> = {}): GithubRelease {
    return {
        tag_name: tag,
        name: tag,
        body: `## What's Changed\r\n* ${tag} by someone\r\n`,
        draft: false,
        prerelease: false,
        published_at: publishedAt,
        ...overrides,
    }
}

const releases = [
    release('v2.0.0-rc.1', '2026-11-20T10:00:00Z', { prerelease: true }),
    release('v1.1.0', '2026-11-10T10:00:00Z'),
    release('v2.0.0', '2026-11-22T10:00:00Z'),
    release('v1.0.0', '2026-11-01T10:00:00Z', { name: '' }),
    release('v3.0.0', '2026-11-23T10:00:00Z', { draft: true, published_at: null }),
    release('feature/x', '2026-11-05T10:00:00Z'),
]

let root: string
let directory: string

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'versions-'))
    directory = root
    process.env.VERSIONS_DIR = directory
})

afterEach(() => {
    rmSync(root, { recursive: true, force: true })
})

function bake(currentTag: string, bakeReleases = releases) {
    return versionsOperations.internal.bake.internalCall({
        params: { directory },
        data: { repositoryUrl, currentTag, releases: bakeReleases },
    })
}

function writeVersionsFile(content: unknown) {
    writeFileSync(join(directory, 'versions.json'), JSON.stringify(content))
}

describe('baking the versions', () => {
    test('keeps the published releases that are no pre-release, and marks the one being built current', async () => {
        const { versions } = await bake('v2.0.0')
        expect(versions.map(version => version.version).sort()).toEqual(['v1.0.0', 'v1.1.0', 'v2.0.0'])
        expect(versions.filter(version => version.current).map(version => version.version)).toEqual(['v2.0.0'])
    })

    test('keeps the pre-release being built', async () => {
        const { versions } = await bake('v2.0.0-rc.1')
        expect(versions.map(version => version.version).sort()).toEqual(['v1.0.0', 'v1.1.0', 'v2.0.0', 'v2.0.0-rc.1'])
        expect(versions.find(version => version.current)?.version).toBe('v2.0.0-rc.1')
    })

    test('writes each notes file without carriage returns, and no file for a tag a path would read', async () => {
        await bake('v2.0.0')
        expect(readFileSync(join(directory, 'v1.1.0.md'), 'utf8')).toBe('## What\'s Changed\n* v1.1.0 by someone\n')
        expect(existsSync(join(directory, 'feature'))).toBe(false)
    })

    test('names a version by its tag when its release has no name', async () => {
        const { versions } = await bake('v2.0.0')
        expect(versions.find(version => version.version === 'v1.0.0')?.name).toBe('v1.0.0')
    })

    test('refuses a tag no published release has', async () => {
        await expect(bake('v3.0.0')).rejects.toMatchObject({ errorCode: 'NOT FOUND' })
        await expect(bake('v9.9.9')).rejects.toMatchObject({ errorCode: 'NOT FOUND' })
        expect(existsSync(join(directory, 'versions.json'))).toBe(false)
    })

    test('refuses a tag being built that a path would read', async () => {
        await expect(bake('../v2.0.0', [release('../v2.0.0', '2026-11-22T10:00:00Z')]))
            .rejects.toMatchObject({ errorCode: 'BAD DATA' })
    })
})

describe('reading the versions', () => {
    test('reads back what was baked, newest first, with the notes as html', async () => {
        await bake('v1.1.0')

        const versions = await versionsOperations.readAll({})
        expect(versions.map(version => version.version)).toEqual(['v2.0.0', 'v1.1.0', 'v1.0.0'])
        expect(versions[1]).toMatchObject({
            version: 'v1.1.0',
            name: 'v1.1.0',
            current: true,
            releasedAt: new Date('2026-11-10T10:00:00Z'),
        })
        expect(versions[1].notesHtml).toContain('<h2>What\'s Changed</h2>')
        expect(versions[1].notesHtml).toContain('<li>v1.1.0 by someone</li>')

        expect(await versionsOperations.readCurrent({})).toEqual({
            version: 'v1.1.0',
            name: 'v1.1.0',
            releasedAt: new Date('2026-11-10T10:00:00Z'),
        })
        expect(await versionsOperations.readRepositoryUrl({})).toBe(repositoryUrl)
    })

    test('has no versions and no repository without a versions directory', async () => {
        process.env.VERSIONS_DIR = join(directory, 'missing')
        expect(await versionsOperations.readAll({})).toEqual([])
        expect(await versionsOperations.readCurrent({})).toBeNull()
        expect(await versionsOperations.readRepositoryUrl({})).toBeNull()
    })

    test('fails on a versions file that is not json', async () => {
        writeFileSync(join(directory, 'versions.json'), '{ "versions": ')
        await expect(versionsOperations.readAll({})).rejects.toBeInstanceOf(Smorekopp)
    })

    test('reads the versions file again after a failed read', async () => {
        writeFileSync(join(directory, 'versions.json'), '{ "versions": ')
        await expect(versionsOperations.readCurrent({})).rejects.toBeInstanceOf(Smorekopp)

        await bake('v2.0.0')
        expect((await versionsOperations.readCurrent({}))?.version).toBe('v2.0.0')
    })

    test('fails on a versions file without exactly one current version', async () => {
        writeFileSync(join(directory, 'v1.md'), '')
        writeFileSync(join(directory, 'v2.md'), '')
        writeVersionsFile({
            repositoryUrl,
            versions: ['v1', 'v2'].map(version => ({
                version,
                name: version,
                releasedAt: '2026-11-01T10:00:00Z',
                notesFile: `${version}.md`,
                current: true,
            })),
        })
        await expect(versionsOperations.readCurrent({})).rejects.toBeInstanceOf(Smorekopp)
    })

    test('fails on a notes file outside the versions directory', async () => {
        writeFileSync(join(root, 'secret.md'), 'secret')
        directory = join(root, 'inner')
        mkdirSync(directory)
        process.env.VERSIONS_DIR = directory
        writeVersionsFile({
            repositoryUrl,
            versions: [{
                version: 'v1',
                name: 'v1',
                releasedAt: '2026-11-01T10:00:00Z',
                notesFile: '../secret.md',
                current: true,
            }],
        })
        await expect(versionsOperations.readAll({})).rejects.toBeInstanceOf(Smorekopp)
    })

    test('fails on a repository url that is no web address', async () => {
        writeFileSync(join(directory, 'v1.md'), '')
        writeVersionsFile({
            repositoryUrl: 'ftp://example.com/repository',
            versions: [{ version: 'v1', name: 'v1', releasedAt: '2026-11-01T10:00:00Z', notesFile: 'v1.md', current: true }],
        })
        await expect(versionsOperations.readRepositoryUrl({})).rejects.toBeInstanceOf(Smorekopp)
    })
})
