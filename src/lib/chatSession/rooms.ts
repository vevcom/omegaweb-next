import { watchWithInvited } from './invited'
import { loadedChatSdk } from './sdk'
import { isSameList } from './watch'
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
    /** See kindOf. */
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
        .map(room => ({
            id: room.roomId,
            name: room.name,
            kind: kindOf(room),
            isInvitation: room.getMyMembership() === 'invite',
        }))
        .sort((one, other) => one.name.localeCompare(other.name, 'nb'))
}

export type ListedRoom = StandaloneRoom & {
    /**
     * How many messages the user has not read, as the homeserver counts them: those it would
     * notify the user of, since the one the user last told it was read.
     */
    unread: number,
    /** How many of the unread mention the user. */
    mentions: number,
    /** What the homeserver calls the one who asked the user into the room. Null for a room the user is in. */
    inviterName: string | null,
}

/**
 * The list of standaloneRoomsOf as a component shows it, each room with its unread, which changes
 * as the homeserver tells of the rooms. A direct message whose other one has not answered is
 * called by their name once the homeserver has said who they are, see watchWithInvited.
 */
export function watchStandaloneRooms(client: MatrixClient, roomIdsOfSpaces: readonly string[]): Watched<ListedRoom[]> {
    const { NotificationCountType } = loadedChatSdk()
    return watchWithInvited(client, () => standaloneRoomsOf(client, roomIdsOfSpaces).map(listed => {
        const room = client.getRoom(listed.id)
        const inviterId = listed.isInvitation ? room?.getMember(room.myUserId)?.events.member?.getSender() : null
        return {
            ...listed,
            unread: room?.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
            mentions: room?.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0,
            inviterName: inviterId ? room?.getMember(inviterId)?.name ?? inviterId : null,
        }
    }), isSameList)
}

/** A room the user is in, which is one that opens. Null until the client knows of it, and for a room the user is not in. */
export function joinedRoom(client: MatrixClient, roomId: string): Room | null {
    const room = client.getRoom(roomId)
    return room?.getMyMembership() === 'join' ? room : null
}

/**
 * The direct message the user has with another: a direct message as kindOf has it that the user
 * is in, where the other has joined or is asked in and has not answered, and the one last written
 * in when there are several. Who asked the user into a room says nothing of who is in it now, so
 * a room the other has left is not one, whoever is in it in their place. A room of a space has a
 * name, so none of them is one. Null when the two have none, and for one whose other one the
 * homeserver has not told the client of yet, see watchWithInvited.
 */
export function directRoomWith(client: MatrixClient, userId: string): Room | null {
    const ownId = client.getSafeUserId()
    if (userId === ownId) return null
    const [latest] = standaloneRoomsOf(client, [])
        .filter(({ kind, isInvitation }) => kind === 'DIRECT' && !isInvitation)
        .flatMap(({ id }) => client.getRoom(id) ?? [])
        .filter(room => ['join', 'invite'].includes(room.getMember(userId)?.membership ?? ''))
        .sort((one, other) => other.getLastActiveTimestamp() - one.getLastActiveTimestamp())
    return latest ?? null
}

/**
 * directRoomWith as a component shows it. It is `LOOKING` while the homeserver is asked who is
 * asked into a room that may be the one with this user, which is one the SDK guesses is, so
 * nobody is told they have no direct message, and starts a second, while they have one.
 */
export function watchDirectRoomWith(client: MatrixClient, userId: string): Watched<Room | 'LOOKING' | null> {
    return watchWithInvited(client, asked => {
        const isAsking = asked.some(room => room.guessDMUserId() === userId)
        return directRoomWith(client, userId) ?? (isAsking ? 'LOOKING' : null)
    })
}

/** A direct message another user has asked the user into, which the user has not answered. Null when there is none. */
export function directInvitationFrom(client: MatrixClient, userId: string): Room | null {
    return client.getRooms().find(room => (
        room.getMyMembership() === 'invite' && room.getDMInviter() === userId && kindOf(room) === 'DIRECT'
    )) ?? null
}

/**
 * A direct message is a room of two without a name that nobody else gets into or reads: one of
 * the two who are in it made it, only one who is asked in may join it, and what is written in it
 * is not for everyone to read. Any other room is a group. Whoever made a room may have set it up
 * to be read from outside, so one that a third made and left is no direct message, whoever is in
 * it now. Of a room the user is only asked into the client has what the invitation carries, which
 * is not who else is in it: it is one when the one who asked made it and asked as into a direct
 * message.
 */
export function kindOf(room: Room): StandaloneRoom['kind'] {
    const { HistoryVisibility, JoinRule } = loadedChatSdk()
    const hasName = Boolean(room.currentState.getStateEvents('m.room.name', '')?.getContent().name)
    const maker = room.getCreator()
    if (maker === null || hasName) return 'GROUP'
    const isClosed = room.getJoinRule() === JoinRule.Invite
        && room.getHistoryVisibility() !== HistoryVisibility.WorldReadable
    const isOfTwo = room.getMyMembership() === 'invite'
        ? room.getDMInviter() === maker
        : room.getInvitedAndJoinedMemberCount() === 2
            && ['join', 'invite'].includes(room.getMember(maker)?.membership ?? '')
    return isClosed && isOfTwo ? 'DIRECT' : 'GROUP'
}
