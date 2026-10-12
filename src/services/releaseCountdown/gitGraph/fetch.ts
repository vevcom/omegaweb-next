import '@pn-server-only'
import { buildGitGraph } from './build'
import { GITHUB_TOKEN, GIT_GRAPH_REPOSITORY, GIT_GRAPH_REPOSITORY_URL } from '@/services/releaseCountdown/constants'
import { ServiceError } from '@/services/error'
import { z } from 'zod'
import type { RawCommit } from './build'
import type { GitGraph } from './types'

const PAGE_SIZE = 100
const UNKNOWN_AUTHOR = 'ukjent'

const commitsPageSchema = z.array(z.object({
    sha: z.string(),
    parents: z.array(z.object({ sha: z.string() })),
    commit: z.object({
        message: z.string(),
        author: z.object({
            name: z.string(),
            date: z.string(),
        }).nullable(),
    }),
}))

function commitsUrl(page: number) {
    const url = new URL(
        `https://api.github.com/repos/${GIT_GRAPH_REPOSITORY.owner}/${GIT_GRAPH_REPOSITORY.name}/commits`
    )
    url.searchParams.set('sha', GIT_GRAPH_REPOSITORY.branch)
    url.searchParams.set('per_page', String(PAGE_SIZE))
    url.searchParams.set('page', String(page))
    return url
}

/**
 * The number of the last page, read from the Link header GitHub pages with. Absent on the only
 * page of a short history.
 */
function lastPageOf(response: Response): number | null {
    const match = response.headers.get('link')?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/)
    return match ? Number(match[1]) : null
}

async function fetchCommitsPage(page: number): Promise<{ commits: RawCommit[], lastPage: number | null }> {
    const response = await fetch(commitsUrl(page), {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'project-next-release-countdown',
            ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
        },
        cache: 'no-store',
    })
    if (!response.ok) {
        const rateLimited = response.headers.get('x-ratelimit-remaining') === '0'
        throw new ServiceError(
            'SERVER ERROR',
            rateLimited
                ? 'GitHub har avvist for mange forespørsler fra denne adressen - '
                    + 'prøv igjen om en time, eller sett GITHUB_TOKEN'
                : `GitHub svarte ${response.status} på side ${page} av historikken`,
        )
    }
    const parsed = commitsPageSchema.safeParse(await response.json())
    if (!parsed.success) {
        throw new ServiceError('SERVER ERROR', `GitHub svarte med noe annet enn commits på side ${page}`)
    }
    return {
        lastPage: lastPageOf(response),
        commits: parsed.data.map(({ sha, parents, commit }) => ({
            hash: sha,
            parents: parents.map(parent => parent.sha),
            author: commit.author?.name ?? UNKNOWN_AUTHOR,
            timestamp: commit.author ? Math.floor(new Date(commit.author.date).getTime() / 1000) : 0,
            subject: commit.message.split('\n')[0],
        })),
    }
}

/**
 * The whole history of the repository as a git graph, read from GitHub - the containers have no
 * git history of their own. The first page says how many there are, and the rest are fetched at
 * once.
 */
export async function fetchGitGraph(): Promise<GitGraph> {
    const first = await fetchCommitsPage(1)
    const remainingPages = Array.from({ length: (first.lastPage ?? 1) - 1 }, (_, index) => index + 2)
    const rest = await Promise.all(remainingPages.map(fetchCommitsPage))
    const commits = [first, ...rest].flatMap(page => page.commits)
    return buildGitGraph(commits, GIT_GRAPH_REPOSITORY_URL)
}
