import { buildGitGraph } from '@/services/releaseCountdown/gitGraph/build'
import { describe, expect, test } from '@jest/globals'
import type { RawCommit } from '@/services/releaseCountdown/gitGraph/build'

function commit(hash: string, parents: string[], timestamp: number, author = 'ada'): RawCommit {
    return { hash, parents, author, timestamp, subject: `commit ${hash}` }
}

// A branch off `a` that is merged back in `d`:
//   d (merge of c and b)
//   | \
//   c  b
//   | /
//   a
const history = [
    commit('d', ['c', 'b'], 40),
    commit('c', ['a'], 30),
    commit('b', ['a'], 20, 'bob'),
    commit('a', [], 10),
]

describe('buildGitGraph', () => {
    test('lists commits oldest first with parents as indices', () => {
        const graph = buildGitGraph(history, 'repo')

        expect(graph.commits.map(([hash]) => hash)).toEqual(['a', 'b', 'c', 'd'])
        expect(graph.commits[3][2]).toEqual([2, 1])
        expect(graph.head).toBe('d')
    })

    test('gives the merged branch its own lane and the trunk lane 0', () => {
        const graph = buildGitGraph(history, 'repo')
        const laneOf = Object.fromEntries(graph.commits.map(([hash, lane]) => [hash, lane]))

        expect(laneOf.a).toBe(0)
        expect(laneOf.c).toBe(0)
        expect(laneOf.d).toBe(0)
        expect(laneOf.b).toBe(1)
        expect(graph.laneCount).toBe(2)
    })

    test('indexes authors', () => {
        const graph = buildGitGraph(history, 'repo')

        expect(graph.authors).toEqual(['ada', 'bob'])
        expect(graph.commits[1][3]).toBe(1)
    })

    test('puts a child before its parents whatever order the commits came in', () => {
        // Dated as the GitHub API would list them: the branch commit was made after the trunk
        // commit it is merged with, so by date `b` comes before `c`, and here `a` is listed first
        // of all.
        const byDate = [history[3], history[0], history[2], history[1]]
        const graph = buildGitGraph(byDate, 'repo')

        expect(graph.commits.map(([hash]) => hash)).toEqual(['a', 'c', 'b', 'd'])
        graph.commits.forEach(([, , parents], index) => {
            parents.forEach(parent => expect(parent).toBeLessThan(index))
        })
    })

    test('keeps a commit listed twice once', () => {
        const graph = buildGitGraph([...history, history[1]], 'repo')

        expect(graph.commits).toHaveLength(4)
    })

    test('shortens long subjects', () => {
        const long = 'x'.repeat(100)
        const graph = buildGitGraph([{ ...commit('a', [], 1), subject: long }], 'repo')

        expect(graph.commits[0][5]).toHaveLength(72)
        expect(graph.commits[0][5].endsWith('…')).toBe(true)
    })
})
