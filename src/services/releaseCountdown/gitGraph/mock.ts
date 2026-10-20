import { buildGitGraph } from './build'
import { GIT_GRAPH_REPOSITORY_URL } from '@/services/releaseCountdown/constants'
import type { RawCommit } from './build'
import type { GitGraph } from './types'

const COMMIT_COUNT = 1500
const SEED = 20231026
const START_TIMESTAMP = Date.UTC(2023, 7, 26) / 1000
const AVERAGE_SECONDS_BETWEEN_COMMITS = 18 * 60 * 60
const MAX_OPEN_BRANCHES = 4

const AUTHORS = ['Ola Nordmann', 'Kari Nordmann', 'Per Hansen', 'Ingrid Berg', 'Lars Johansen', 'Sofie Lie', 'Emil Dahl']
const TYPES = ['feat', 'fix', 'chore', 'refactor', 'style', 'test']
const SCOPES = ['events', 'cabin', 'users', 'news', 'ombul', 'notifications', 'shop', 'cms', 'auth', 'admin', 'groups']
const CHANGES = [
    'add a page for it',
    'handle the empty case',
    'show the right date',
    'move the form to its own component',
    'clean up the styling',
    'stop the double submit',
    'link to it from the menu',
    'check permissions before saving',
    'fix the mobile layout',
    'make the list load faster',
    'rename the confusing fields',
    'remove dead code',
    'add tests',
    'show an error when it fails',
]

type Branch = {
    name: string,
    scope: string,
    author: string,
    head: string,
}

/**
 * A made-up history shaped like the real one, with feature branches that run alongside each other
 * and are merged back as pull requests. It is the same every time, and stands in for the history
 * from GitHub when GitHub cannot be reached.
 */
export function buildMockGitGraph(): GitGraph {
    const random = seededRandom(SEED)
    const pick = <Item>(items: Item[]) => items[Math.floor(random() * items.length)]
    const subject = (scope: string) => `${pick(TYPES)}(${scope}): ${pick(CHANGES)}`

    const commits: RawCommit[] = []
    let timestamp = START_TIMESTAMP
    const commit = (parents: string[], message: string, author: string) => {
        timestamp += Math.floor(random() * 2 * AVERAGE_SECONDS_BETWEEN_COMMITS)
        const hash = Array.from({ length: 40 }, () => Math.floor(random() * 16).toString(16)).join('')
        commits.push({ hash, parents, author, timestamp, subject: message })
        return hash
    }

    let main = commit([], 'initial setup', pick(AUTHORS))
    let pullRequests = 0
    let branchesOpened = 0
    const openBranches: Branch[] = []

    const openBranch = () => {
        branchesOpened += 1
        const scope = pick(SCOPES)
        const author = pick(AUTHORS)
        const name = `${pick(['feat', 'fix', 'refactor'])}/${scope}-${branchesOpened}`
        openBranches.push({ name, scope, author, head: commit([main], subject(scope), author) })
    }
    const mergePullRequest = (branch: Branch) => {
        pullRequests += 1
        openBranches.splice(openBranches.indexOf(branch), 1)
        main = commit([main, branch.head], `Merge pull request #${pullRequests} from vevcom/${branch.name}`, branch.author)
    }

    while (commits.length < COMMIT_COUNT) {
        const roll = random()
        const branch = openBranches.length > 0 ? pick(openBranches) : null
        if (!branch || (openBranches.length < MAX_OPEN_BRANCHES && roll < 0.12)) {
            openBranch()
        } else if (roll < 0.22) {
            mergePullRequest(branch)
        } else if (roll < 0.25) {
            main = commit([main], subject(pick(SCOPES)), pick(AUTHORS))
        } else if (roll < 0.27) {
            branch.head = commit([branch.head, main], `Merge branch 'main' into ${branch.name}`, branch.author)
        } else {
            branch.head = commit([branch.head], subject(branch.scope), branch.author)
        }
    }
    [...openBranches].forEach(mergePullRequest)

    return buildGitGraph(commits, GIT_GRAPH_REPOSITORY_URL)
}

/**
 * The Park-Miller generator, so the same seed always gives the same history.
 */
function seededRandom(seed: number) {
    const modulus = 2147483647
    let state = seed % modulus
    return () => {
        state = state * 48271 % modulus
        return (state - 1) / (modulus - 1)
    }
}
