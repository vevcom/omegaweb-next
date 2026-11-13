import { ROOM_MODERATOR_LEVEL } from './constants'
import type { ChatPowerLevels, Homeserver } from './client'
import type { Change } from './report'

/** Members, admins and rooms are Matrix ids. */
export type WantedSpace = {
    name: string,
    members: string[],
    admins: string[],
    rooms: WantedRoom[],
}

export type WantedRoom = {
    id: string,
    name: string,
}

export type ActualSpace = {
    id: string,
    name: string | undefined,
    membersWithoutBot: string[],
    listedRoomIds: string[],
    rooms: ActualRoom[],
}

export type ActualRoom = {
    id: string,
    name: string | undefined,
    membersWithoutBot: string[],
    levels: ChatPowerLevels,
}

type UserLevels = Record<string, number>

/** Reads and changes nothing: the changes are for the caller to carry out, in this order. */
export function planSpaceChanges(homeserver: Homeserver, wanted: WantedSpace, actual: ActualSpace): Change[] {
    const membersToAdd = wanted.members.filter(userId => !actual.membersWithoutBot.includes(userId))
    const membersToRemove = actual.membersWithoutBot.filter(userId => !wanted.members.includes(userId))

    return [
        ...rename(homeserver, actual, wanted.name),
        ...membersToAdd.map(userId => addMember(homeserver, actual, userId)),
        // Before the rooms, which let the members of the space back in.
        ...membersToRemove.map(userId => removeMember(homeserver, actual, userId)),
        ...wanted.rooms.flatMap(wantedRoom => planRoomChanges(homeserver, wanted, actual, wantedRoom)),
    ]
}

function planRoomChanges(homeserver: Homeserver, wanted: WantedSpace, space: ActualSpace, wantedRoom: WantedRoom): Change[] {
    const room = space.rooms.find(actualRoom => actualRoom.id === wantedRoom.id)
    // A room that could not be read is left for a later run.
    if (!room) return []

    return [
        ...rename(homeserver, room, wantedRoom.name),
        ...list(homeserver, space, room),
        ...removeEveryoneBut(wanted.members, homeserver, room),
        ...setModerators(homeserver, room, wanted.admins),
    ]
}

export function removeEveryoneBut(
    userIdsToKeep: string[],
    homeserver: Homeserver,
    room: { id: string, membersWithoutBot: string[] },
): Change[] {
    return room.membersWithoutBot
        .filter(userId => !userIdsToKeep.includes(userId))
        .map(userId => removeMember(homeserver, room, userId))
}

function rename(homeserver: Homeserver, room: { id: string, name: string | undefined }, name: string): Change[] {
    if (room.name === name) return []
    return [{
        what: `rename ${room.id} to ${name}`,
        run: () => homeserver.writeState(room.id, 'm.room.name', { name }),
    }]
}

function list(homeserver: Homeserver, space: ActualSpace, room: ActualRoom): Change[] {
    if (space.listedRoomIds.includes(room.id)) return []
    return [{
        what: `list ${room.id} in ${space.id}`,
        run: () => homeserver.listRoom(space.id, room.id),
    }]
}

function addMember(homeserver: Homeserver, room: { id: string }, userId: string): Change {
    return {
        what: `add ${userId} to ${room.id}`,
        run: () => homeserver.addMember(room.id, userId),
    }
}

function removeMember(homeserver: Homeserver, room: { id: string }, userId: string): Change {
    return {
        what: `remove ${userId} from ${room.id}`,
        run: () => homeserver.removeMember(room.id, userId),
    }
}

function setModerators(homeserver: Homeserver, room: ActualRoom, moderators: string[]): Change[] {
    const levels = moderatorLevelsOf(moderators)
    if (sameLevels(room.levels.users ?? {}, levels)) return []
    return [{
        what: `set the moderators of ${room.id}`,
        run: () => homeserver.writeState(room.id, 'm.room.power_levels', { ...room.levels, users: levels }),
    }]
}

export function moderatorLevelsOf(moderators: string[]): UserLevels {
    return Object.fromEntries(moderators.map(userId => [userId, ROOM_MODERATOR_LEVEL]))
}

function sameLevels(one: UserLevels, other: UserLevels): boolean {
    return Object.keys(one).length === Object.keys(other).length
        && Object.entries(one).every(([userId, level]) => other[userId] === level)
}
