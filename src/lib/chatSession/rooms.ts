import { isSameList, watchAtSync } from './watch'
import type { Watched } from './watch'
import type { MatrixClient, Room, RoomNameState, RoomNameType } from 'matrix-js-sdk'

/**
 * What a room without a name of its own is called: the others in it, from the `names` and the
 * `count` the SDK gives of them, worded as the SDK words it in English.
 */
export function nameOfMembers(names: string[], count: number): string {
    const others = count - 1
    if (names.length === 0) return 'Tomt rom'
    if (names.length === 1 && others <= 1) return names[0]
    if (names.length === 2 && others <= 2) return `${names[0]} og ${names[1]}`
    return others > 1 ? `${names[0]} og ${others} andre` : `${names[0]} og 1 annen`
}

/** The names the client gives rooms, for its `roomNameGenerator`. Null leaves a room the name it has. */
export const roomNameIn = (types: typeof RoomNameType) => (_roomId: string, state: RoomNameState): string | null => {
    switch (state.type) {
        case types.Generated: {
            const members = nameOfMembers(state.names, state.count)
            return state.subtype === 'Inviting' ? `Inviterer ${members}` : members
        }
        case types.EmptyRoom:
            return state.oldName ? `Tomt rom (var ${state.oldName})` : 'Tomt rom'
        default:
            return null
    }
}

export type StandaloneRoom = {
    id: string,
    name: string,
    /**
     * A room of two without a name is a direct message, and any other a group, as the notifications
     * have it. Who is in a room the user is only asked into is not known, so its inviter says which.
     */
    kind: 'DIRECT' | 'GROUP',
    /** The user is asked into the room and has not answered. */
    isInvitation: boolean,
}

/**
 * The rooms the user is in or asked into outside every space: the direct messages and the groups,
 * by name. A space is no room to write in, and which rooms are a space's the app knows, so they
 * are given as `roomIdsOfSpaces` and left out.
 */
export function standaloneRoomsOf(client: MatrixClient, roomIdsOfSpaces: readonly string[]): StandaloneRoom[] {
    return client.getRooms()
        .filter(room => !room.isSpaceRoom() && !roomIdsOfSpaces.includes(room.roomId))
        .filter(room => ['join', 'invite'].includes(room.getMyMembership()))
        .map(room => {
            const hasName = Boolean(room.currentState.getStateEvents('m.room.name', '')?.getContent().name)
            const isInvitation = room.getMyMembership() === 'invite'
            const isOfTwo = isInvitation
                ? room.getDMInviter() !== undefined
                : room.getInvitedAndJoinedMemberCount() === 2
            return {
                id: room.roomId,
                name: room.name,
                kind: !hasName && isOfTwo ? 'DIRECT' as const : 'GROUP' as const,
                isInvitation,
            }
        })
        .sort((one, other) => one.name.localeCompare(other.name, 'nb'))
}

/** The list of standaloneRoomsOf as a component shows it, which changes as the homeserver tells of the rooms. */
export function watchStandaloneRooms(client: MatrixClient, roomIdsOfSpaces: readonly string[]): Watched<StandaloneRoom[]> {
    return watchAtSync(client, () => standaloneRoomsOf(client, roomIdsOfSpaces), isSameList)
}

/** A room the user is in, which is one that opens. Null until the client knows of it, and for a room the user is not in. */
export function joinedRoom(client: MatrixClient, roomId: string): Room | null {
    const room = client.getRoom(roomId)
    return room?.getMyMembership() === 'join' ? room : null
}

/**
 * The direct message the user has with another: a room without a name that the user is in, of
 * the two of them and nobody else, where the other has joined, and the one last written in when
 * there are several. Who asked the user into a room says nothing of who is in it now, so a room
 * the other has left is not one, whoever is in it in their place. One the other is only asked
 * into is not one either: the homeserver does not tell the client of a member who has not
 * joined. A room of a space has a name, so none of them is one. Null when the two have none.
 */
export function directRoomWith(client: MatrixClient, userId: string): Room | null {
    const ownId = client.getSafeUserId()
    if (userId === ownId) return null
    const [latest] = standaloneRoomsOf(client, [])
        .filter(({ kind, isInvitation }) => kind === 'DIRECT' && !isInvitation)
        .flatMap(({ id }) => client.getRoom(id) ?? [])
        .filter(room => room.getMember(userId)?.membership === 'join')
        .sort((one, other) => other.getLastActiveTimestamp() - one.getLastActiveTimestamp())
    return latest ?? null
}
