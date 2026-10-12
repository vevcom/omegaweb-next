import type { GitGraph, GitGraphCommit } from './types'

const MAX_SUBJECT_LENGTH = 72

/**
 * A commit as read from wherever the history comes from, before lanes are assigned.
 */
export type RawCommit = {
    hash: string,
    parents: string[],
    author: string,
    // Unix timestamp in seconds.
    timestamp: number,
    subject: string,
}

/**
 * A minimal binary min-heap of commit indices, so the topological ordering below can always pick
 * the earliest ready commit without scanning for it.
 */
function makeMinHeap() {
    const items: number[] = []
    const swap = (first: number, second: number) => {
        [items[first], items[second]] = [items[second], items[first]]
    }
    return {
        get size() {
            return items.length
        },
        push(value: number) {
            items.push(value)
            let index = items.length - 1
            while (index > 0) {
                const parent = Math.floor((index - 1) / 2)
                if (items[parent] <= items[index]) break
                swap(parent, index)
                index = parent
            }
        },
        pop(): number {
            const top = items[0]
            const last = items.pop()
            if (items.length > 0 && last !== undefined) {
                items[0] = last
                let index = 0
                for (;;) {
                    const left = 2 * index + 1
                    const right = left + 1
                    let smallest = index
                    if (left < items.length && items[left] < items[smallest]) smallest = left
                    if (right < items.length && items[right] < items[smallest]) smallest = right
                    if (smallest === index) break
                    swap(smallest, index)
                    index = smallest
                }
            }
            return top
        },
    }
}

/**
 * Orders commits so that every commit comes before all of its parents, like `git log --topo-order`.
 * Among the commits that are ready, the one that came first in the input wins, so an input that
 * is already in topological order comes out unchanged, and a date-ordered one (as the GitHub API
 * returns) is disturbed as little as possible.
 */
function topologicalOrder(commits: RawCommit[]): RawCommit[] {
    const indexOfCommit = new Map(commits.map((commit, index) => [commit.hash, index]))
    const childrenLeft = commits.map(() => 0)
    commits.forEach(commit => {
        commit.parents.forEach(parent => {
            const index = indexOfCommit.get(parent)
            if (index !== undefined) childrenLeft[index] += 1
        })
    })

    const ready = makeMinHeap()
    childrenLeft.forEach((count, index) => {
        if (count === 0) ready.push(index)
    })

    const ordered: RawCommit[] = []
    while (ready.size > 0) {
        const commit = commits[ready.pop()]
        ordered.push(commit)
        commit.parents.forEach(parent => {
            const index = indexOfCommit.get(parent)
            if (index === undefined) return
            childrenLeft[index] -= 1
            if (childrenLeft[index] === 0) ready.push(index)
        })
    }
    return ordered
}

/**
 * Lays out commits (newest first, in topological order) into lanes the way `git log --graph` does:
 * walking from newest to oldest, each lane holds the hash of the commit it is waiting for.
 */
function assignLanes(commits: RawCommit[]): Map<string, number> {
    const lanes: (string | null)[] = []
    const allocateLane = () => {
        const free = lanes.indexOf(null)
        return free === -1 ? lanes.length : free
    }
    const laneOfCommit = new Map<string, number>()
    commits.forEach(commit => {
        const waitingLane = lanes.indexOf(commit.hash)
        const lane = waitingLane === -1 ? allocateLane() : waitingLane
        laneOfCommit.set(commit.hash, lane)

        // Branches that were waiting for this commit merge into it here.
        lanes.forEach((waitingFor, index) => {
            if (waitingFor === commit.hash) lanes[index] = null
        })

        const [firstParent, ...otherParents] = commit.parents
        lanes[lane] = firstParent ?? null
        otherParents.forEach(parent => {
            if (!lanes.includes(parent)) lanes[allocateLane()] = parent
        })
    })
    return laneOfCommit
}

/**
 * Builds the compact git graph the release countdown plays from a list of commits, in any order.
 * A commit listed more than once (as happens when the history is paged while someone pushes) is
 * kept once.
 */
export function buildGitGraph(input: RawCommit[], repository: string): GitGraph {
    const seen = new Set<string>()
    const unique = input.filter(commit => {
        if (seen.has(commit.hash)) return false
        seen.add(commit.hash)
        return true
    })
    const commits = topologicalOrder(unique)
    const laneOfCommit = assignLanes(commits)

    const oldestFirst = commits.toReversed()
    const indexOfCommit = new Map(oldestFirst.map((commit, index) => [commit.hash, index]))
    const authors = Array.from(new Set(oldestFirst.map(commit => commit.author)))
    const indexOfAuthor = new Map(authors.map((author, index) => [author, index]))

    return {
        repository,
        head: commits[0]?.hash ?? '',
        generatedAt: new Date().toISOString(),
        laneCount: Math.max(0, ...Array.from(laneOfCommit.values())) + 1,
        authors,
        commits: oldestFirst.map((commit): GitGraphCommit => [
            commit.hash.slice(0, 7),
            laneOfCommit.get(commit.hash) ?? 0,
            commit.parents.flatMap(parent => {
                const index = indexOfCommit.get(parent)
                return index === undefined ? [] : [index]
            }),
            indexOfAuthor.get(commit.author) ?? 0,
            commit.timestamp,
            commit.subject.length > MAX_SUBJECT_LENGTH
                ? `${commit.subject.slice(0, MAX_SUBJECT_LENGTH - 1)}…`
                : commit.subject,
        ]),
    }
}
