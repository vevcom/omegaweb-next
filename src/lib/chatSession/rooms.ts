import type { MatrixClient, RoomNameState, RoomNameType } from 'matrix-js-sdk'

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
