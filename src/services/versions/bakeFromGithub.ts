import '@ow-server-only'
import { versionsDirectory } from './constants'
import { versionsOperations } from './operations'
import { ParseError, Smorekopp } from '@/services/error'
import logger from '@/lib/logger'
import type { GithubRelease } from './types'

const releasesPerPage = 100

async function main() {
    const [repository, serverUrl, currentTag, directory = versionsDirectory()] = process.argv.slice(2)
    if (!repository || !serverUrl || !currentTag) {
        throw new Error('Usage: npm run versions:bake -- <owner/name> <server url> <tag being built> [directory]')
    }

    const versionsFile = await versionsOperations.internal.bake.internalCall({
        params: { directory },
        data: {
            repositoryUrl: `${serverUrl}/${repository}`,
            currentTag,
            releases: await fetchReleases(repository),
        },
    })
    logger.info(`Wrote ${versionsFile.versions.length} versions to ${directory}`)
}

async function fetchReleases(repository: string): Promise<GithubRelease[]> {
    const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com'
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
    const releases: GithubRelease[] = []
    for (let page = 1; ; page++) {
        const response = await fetch(`${apiUrl}/repos/${repository}/releases?per_page=${releasesPerPage}&page=${page}`, {
            headers: {
                Accept: 'application/vnd.github+json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        })
        if (!response.ok) {
            throw new Error(`GitHub answered ${response.status} when listing the releases of ${repository}`)
        }
        const pageOfReleases = await response.json() as GithubRelease[]
        releases.push(...pageOfReleases)
        if (pageOfReleases.length < releasesPerPage) return releases
    }
}

// An error the operation did not expect arrives as UNKNOWN ERROR, its cause already logged by the service layer.
function describeFailure(error: unknown): string {
    if (error instanceof ParseError) {
        const issues = error.parseError.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        return `${error.errorCode}: ${issues.join(', ')}`
    }
    if (error instanceof Smorekopp) return `${error.errorCode}: ${error.errors.map(({ message }) => message).join(', ')}`
    return error instanceof Error ? (error.stack ?? error.message) : String(error)
}

main().catch((error: unknown) => {
    logger.error(`Baking the versions failed: ${describeFailure(error)}`)
    process.exitCode = 1
})
