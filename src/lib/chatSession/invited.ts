import { loadedChatSdk } from './sdk'
import { watchAtSync } from './watch'
import type { Watched } from './watch'
import type { MatrixClient, Room } from 'matrix-js-sdk'

// The rooms the homeserver has given the members of, so none is asked of again when its answer named nobody asked in.
const answered = new WeakSet<Room>()
// When each room was first asked of, since an answer is only waited for so long.
const askedAt = new WeakMap<Room, number>()

/** How long the answer of who is asked into a room is waited for before what is read goes on without it. */
export const INVITED_ANSWER_WAIT_MS = 20_000

/**
 * As watchAtSync, for what is read of who the other one of a direct message is. The client loads
 * the members of a room as they write, and a room it is told of whole comes with those alone: the
 * homeserver then counts one who is asked in and has not answered, and does not say who it is. So
 * a room the user started is not known as the direct message with anyone when the page is loaded
 * anew. While something watches, the members of each such room are asked for, once, and again at
 * each sync after a failure. `read` is given the rooms whose answer is still waited for, which a
 * room is for INVITED_ANSWER_WAIT_MS from when it was first asked of: a homeserver that does not
 * answer keeps nothing looked for for ever.
 */
export function watchWithInvited<Shown>(
    client: MatrixClient,
    read: (asked: Room[]) => Shown,
    isSame?: (one: Shown, other: Shown) => boolean,
): Watched<Shown> {
    const { ClientEvent } = loadedChatSdk()
    const isWaitedFor = (room: Room) => Date.now() - (askedAt.get(room) ?? Date.now()) < INVITED_ANSWER_WAIT_MS
    const watched = watchAtSync(client, () => read(roomsWithUntoldInvited(client).filter(isWaitedFor)), isSame)
    return {
        read: watched.read,
        subscribe: onChange => {
            const ask = () => roomsWithUntoldInvited(client).forEach(room => {
                if (!askedAt.has(room)) askedAt.set(room, Date.now())
                // A room is asked of once however often this runs, and again only after a failure.
                void room.loadMembersIfNeeded().then(() => {
                    answered.add(room)
                    onChange()
                }, () => undefined)
            })
            ask()
            // eslint-disable-next-line no-sync -- The event of the client's sync, and no synchronous call.
            client.on(ClientEvent.Sync, ask)
            const unsubscribe = watched.subscribe(onChange)
            return () => {
                // eslint-disable-next-line no-sync -- As above.
                client.off(ClientEvent.Sync, ask)
                unsubscribe()
            }
        },
    }
}

/** The rooms where the user is with one who is asked in, whom the homeserver has counted and not named. */
function roomsWithUntoldInvited(client: MatrixClient): Room[] {
    return client.getRooms().filter(room => (
        room.getMyMembership() === 'join'
        && room.getJoinedMemberCount() === 1
        && room.getInvitedMemberCount() === 1
        && room.getMembersWithMembership('invite').length === 0
        && !answered.has(room)
    ))
}
