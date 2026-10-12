/**
 * A commit in the compact git graph snapshot:
 * [short hash, lane, indices of parents, index of author, unix timestamp (seconds), subject]
 * Parent indices refer to positions in GitGraph['commits'].
 */
export type GitGraphCommit = [string, number, number[], number, number, string]

/**
 * A precomputed git graph. Commits are ordered oldest first, and lanes are assigned ahead of time
 * so the client only has to draw.
 */
export type GitGraph = {
    repository: string,
    head: string,
    generatedAt: string,
    laneCount: number,
    authors: string[],
    commits: GitGraphCommit[],
}
