import type { githubReleaseSchema } from './schemas'
import type { z } from 'zod'

export type GithubRelease = z.input<typeof githubReleaseSchema>

export type BakedVersions = {
    repositoryUrl: string | null,
    versions: {
        version: string,
        name: string,
        releasedAt: Date,
        current: boolean,
        notesFile: string,
    }[],
}
