import { RESERVED_CHAT_LOCALPARTS } from '@/services/chat/constants'
import { spellPlainly } from '@/lib/usernames/spellPlainly'

/** Room for the number that tells a localpart from one that is taken. */
const NUMBER_LENGTH = 4

/** How many localparts are tried for a user before giving up. */
export const CHAT_LOCALPART_ATTEMPTS = 10 ** NUMBER_LENGTH - 1

/**
 * What stands before the colon in the Matrix id a user is given: their username, in the lower case
 * letters, digits and . _ - a localpart takes. Letters with marks lose them, anything else is left
 * out, and a user whose username leaves nothing is named by their id.
 */
export function chatLocalpartOf(user: { id: number, username: string }): string {
    const spelled = spellPlainly(user.username)
        .replace(/[^a-z0-9._-]/g, '')
        .replace(/^[._-]+|[._-]+$/g, '')
    return spelled.length > 0 ? spelled : `bruker${user.id}`
}

/**
 * The localparts a user may be given, in the order they are tried: their username, and then with a
 * number after it, from 2, for a user whose username is another's localpart.
 */
export function chatLocalpartAt(user: { id: number, username: string }, attempt: number): string {
    const localpart = chatLocalpartOf(user)
    return attempt === 0 ? localpart : `${localpart}${attempt + 1}`
}

/** Whether a localpart is one of the application's own, which no user is given. */
export const isReservedChatLocalpart = (localpart: string) => RESERVED_CHAT_LOCALPARTS.includes(localpart)
