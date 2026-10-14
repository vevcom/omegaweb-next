import { committeeOperations } from '@/services/groups/committees/operations'

/**
 * A function to get a committee from the shortName param of a page under /committees/[shortName].
 * Meant to be called from a serverPage or serverLayout operation, which supplies the service
 * context - a missing committee throws NOT FOUND, which they render as the not-found page.
 * @param shortName - The shortName route param, still URI-encoded.
 * @returns The committee.
 */
export default async function getCommittee(shortName: string) {
    return committeeOperations.read({
        params: {
            shortName: decodeURIComponent(shortName),
        },
    })
}
