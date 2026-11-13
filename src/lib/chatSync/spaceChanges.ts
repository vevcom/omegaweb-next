import { ROOM_ADMIN_LEVEL, SPACE_ADMIN_LEVEL } from './constants'
import type { ChatPowerLevels, Homeserver } from './client'
import type { Change } from './report'

/** A space as the database says it is to be. Members and admins are Matrix user ids. */
export type WantedSpace = {
    name: string,
    members: string[],
    /** Among the members. */
    admins: string[],
}

/** A space as it is on the homeserver. */
export type ActualSpace = {
    /** The space's own id on the homeserver, where a space is a room that holds rooms. */
    roomId: string,
    name: string | undefined,
    /** Without the bot. */
    members: string[],
    levels: ChatPowerLevels,
    rooms: ActualRoom[],
}

/** A room of a space. `entered` is null for a room the bot is not in yet, which it can neither read nor change. */
export type ActualRoom = {
    id: string,
    entered: {
        levels: ChatPowerLevels,
        /** Those who made the room. They outrank every level, and Matrix refuses them one. */
        creators: string[],
    } | null,
}

type UserLevels = Record<string, number>

/**
 * What it takes to make a space on the homeserver what the database says, in the order it is
 * done. Nothing is read or changed here: the changes are for the caller to carry out.
 */
export function planSpaceChanges(homeserver: Homeserver, wanted: WantedSpace, actual: ActualSpace): Change[] {
    const toAdd = wanted.members.filter(userId => !actual.members.includes(userId))
    const toRemove = actual.members.filter(userId => !wanted.members.includes(userId))

    return [
        ...rename(homeserver, wanted, actual),
        ...toAdd.map(userId => addMember(homeserver, actual, userId)),
        ...toRemove.map(userId => removeMember(homeserver, actual, userId)),
        ...setSpaceAdmins(homeserver, wanted, actual),
        ...actual.rooms.flatMap(room => setRoomAdmins(homeserver, room, wanted)),
    ]
}

/** What it takes to get everyone out of a space, the rooms of it included. */
export function planEmptying(homeserver: Homeserver, actual: ActualSpace): Change[] {
    return actual.members.map(userId => removeMember(homeserver, actual, userId))
}

function rename(homeserver: Homeserver, wanted: WantedSpace, actual: ActualSpace): Change[] {
    if (actual.name === wanted.name) return []
    return [{
        what: `rename the space to ${wanted.name}`,
        run: () => homeserver.writeState(actual.roomId, 'm.room.name', { name: wanted.name }),
    }]
}

function addMember(homeserver: Homeserver, actual: ActualSpace, userId: string): Change {
    return {
        what: `add ${userId}`,
        run: () => homeserver.addMember(actual.roomId, userId),
    }
}

/** Out of the rooms first, since a room lets the members of its space in. */
function removeMember(homeserver: Homeserver, actual: ActualSpace, userId: string): Change {
    return {
        what: `remove ${userId}`,
        run: async () => {
            for (const room of actual.rooms) await homeserver.removeMember(room.id, userId)
            await homeserver.removeMember(actual.roomId, userId)
        },
    }
}

function setSpaceAdmins(homeserver: Homeserver, wanted: WantedSpace, actual: ActualSpace): Change[] {
    const levels = spaceLevelsOf(wanted.admins)
    if (sameLevels(actual.levels.users ?? {}, levels)) return []
    return [{
        what: 'set the admins of the space',
        run: () => homeserver.writeState(actual.roomId, 'm.room.power_levels', { ...actual.levels, users: levels }),
    }]
}

/** A room the bot is not in is entered now, and its admins are set on the next run. */
function setRoomAdmins(homeserver: Homeserver, room: ActualRoom, wanted: WantedSpace): Change[] {
    if (room.entered === null) {
        return [{
            what: `take admin of the room ${room.id}`,
            run: () => homeserver.takeRoomAdmin(room.id),
        }]
    }
    const current = room.entered.levels
    const adminsToGiveALevel = wanted.admins.filter(userId => !room.entered?.creators.includes(userId))
    const levels = roomLevelsOf(current.users ?? {}, adminsToGiveALevel)
    if (sameLevels(current.users ?? {}, levels)) return []
    return [{
        what: `set the admins of the room ${room.id}`,
        run: () => homeserver.writeState(room.id, 'm.room.power_levels', { ...current, users: levels }),
    }]
}

/** In a space the admins are the only ones with a level, apart from the bot that made it. */
export function spaceLevelsOf(admins: string[]): UserLevels {
    return Object.fromEntries(admins.map(userId => [userId, SPACE_ADMIN_LEVEL]))
}

/**
 * In a room, ROOM_ADMIN_LEVEL is the sync's to give and to take: the admins hold it, and no one
 * else does. Every other level is the room's own and is left as it is, a higher one an admin
 * holds among them.
 */
export function roomLevelsOf(current: UserLevels, admins: string[]): UserLevels {
    const withoutFormerAdmins = Object.entries(current)
        .filter(([userId, level]) => level !== ROOM_ADMIN_LEVEL || admins.includes(userId))
    const raised = admins
        .filter(userId => (current[userId] ?? 0) < ROOM_ADMIN_LEVEL)
        .map(userId => [userId, ROOM_ADMIN_LEVEL] as const)
    return Object.fromEntries([...withoutFormerAdmins, ...raised])
}

function sameLevels(one: UserLevels, other: UserLevels): boolean {
    return Object.keys(one).length === Object.keys(other).length
        && Object.entries(one).every(([userId, level]) => other[userId] === level)
}
