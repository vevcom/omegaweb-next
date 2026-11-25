import { notesFilePattern, versionTagPattern } from './constants'
import { z } from 'zod'

const repositoryUrlSchema = z.string().url().regex(/^https?:\/\//)

export const versionsFileSchema = z.object({
    repositoryUrl: repositoryUrlSchema,
    versions: z.array(z.object({
        version: z.string().regex(versionTagPattern),
        name: z.string(),
        releasedAt: z.string().datetime(),
        notesFile: z.string().regex(notesFilePattern),
        current: z.boolean(),
    })).refine(
        versions => versions.filter(version => version.current).length === 1,
        'Exactly one version is current',
    ),
})

export const githubReleaseSchema = z.object({
    tag_name: z.string(),
    name: z.string().nullable(),
    body: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    published_at: z.string().datetime().nullable(),
})

const dataFieldSchemas = z.object({
    repositoryUrl: repositoryUrlSchema,
    currentTag: z.string().regex(versionTagPattern, 'A tag holds only letters, digits, ".", "_" and "-"'),
    releases: z.array(githubReleaseSchema),
})

const paramsFieldSchemas = z.object({
    directory: z.string().min(1),
})

export const versionsSchemas = {
    data: {
        bake: dataFieldSchemas.pick({
            repositoryUrl: true,
            currentTag: true,
            releases: true,
        }),
    },
    params: {
        bake: paramsFieldSchemas.pick({
            directory: true,
        }),
    },
}
