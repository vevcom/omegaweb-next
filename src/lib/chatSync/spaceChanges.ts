import { ROOM_ADMIN_LEVEL, SPACE_ADMIN_LEVEL } from './constants'
import type { ChatPowerLevels, ChatRoom, Homeserver } from './client'
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

/** A room the space lists, or has taken in. */
export type ActualRoom = ChatRoom & {
    id: string,
    /** Who listed the room in the space. Null for a room the space lists no longer. */
    listedBy: string | null,
    /** The space the room has been taken into, by the record of it. Null for a room in none. */
    takenInto: 'THIS_SPACE' | 'ANOTHER_SPACE' | null,
}

/** Where it is kept which rooms a space has taken in. */
export type RoomRecords = {
    takeIn: (roomId: string) => Promise<unknown>,
    forget: (roomId: string) => Promise<unknown>,
}

/**
 * What a room is to the space. Only a HELD room is the space's, to set the admins of and to take
 * its former members out of.
 * - HANDED_OVER: listed by someone who could hand it over, and in no space yet. It is taken in.
 * - HELD: taken in, and still listed.
 * - GIVEN_BACK: taken in, and listed no longer. It is its makers' again.
 * - NOT_THE_SPACES: another space's, or listed by someone it was not theirs to hand over.
 */
export type RoomStanding = 'HANDED_OVER' | 'HELD' | 'GIVEN_BACK' | 'NOT_THE_SPACES'

type UserLevels = Record<string, number>

/**
 * What it takes to make a space on the homeserver what the database says, in the order it is
 * done. Nothing is read or changed here: the changes are for the caller to carry out.
 */
export function planSpaceChanges(
    homeserver: Homeserver,
    records: RoomRecords,
    wanted: WantedSpace,
    actual: ActualSpace,
): Change[] {
    const toAdd = wanted.members.filter(userId => !actual.members.includes(userId))
    const toRemove = actual.members.filter(userId => !wanted.members.includes(userId))

    return [
        ...rename(homeserver, wanted, actual),
        ...roomsThatAre('HANDED_OVER', actual).map(room => takeIn(homeserver, records, room)),
        ...toAdd.map(userId => addMember(homeserver, actual, userId)),
        ...toRemove.map(userId => removeMember(homeserver, actual, userId)),
        ...setSpaceAdmins(homeserver, wanted, actual),
        ...roomsThatAre('HELD', actual).flatMap(room => setRoomAdmins(homeserver, room, wanted)),
        ...roomsThatAre('GIVEN_BACK', actual).map(room => giveBack(homeserver, records, room)),
    ]
}

/** What it takes to get everyone out of a space, the rooms it holds included. */
export function planEmptying(homeserver: Homeserver, actual: ActualSpace): Change[] {
    return actual.members.map(userId => removeMember(homeserver, actual, userId))
}

export function standingOf(room: ActualRoom): RoomStanding {
    if (room.takenInto === 'THIS_SPACE') return room.listedBy === null ? 'GIVEN_BACK' : 'HELD'
    if (room.takenInto === null && room.listedBy !== null && canHandOver(room, room.listedBy)) return 'HANDED_OVER'
    return 'NOT_THE_SPACES'
}

export function roomsThatAre(standing: RoomStanding, actual: ActualSpace): ActualRoom[] {
    return actual.rooms.filter(room => standingOf(room) === standing)
}

/**
 * Whether a room is a user's to hand over to a space: they made it, or hold the level that changes
 * levels in it. So the sync gives a space's admins nothing in a room that whoever listed it could
 * not have given them by hand.
 */
export function canHandOver(room: ChatRoom, userId: string): boolean {
    if (room.creators.includes(userId)) return true
    const { users = {}, users_default: usersDefault = 0, events = {}, state_default: stateDefault = 50 } = room.levels as {
        users?: UserLevels,
        users_default?: number,
        events?: Record<string, number>,
        state_default?: number,
    }
    return (users[userId] ?? usersDefault) >= (events['m.room.power_levels'] ?? stateDefault)
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

/** Out of the rooms the space holds first, since a room lets the members of its space in. */
function removeMember(homeserver: Homeserver, actual: ActualSpace, userId: string): Change {
    return {
        what: `remove ${userId}`,
        run: async () => {
            for (const room of roomsThatAre('HELD', actual)) await homeserver.removeMember(room.id, userId)
            await homeserver.removeMember(actual.roomId, userId)
        },
    }
}

/** Recorded first, so a room the bot then fails to enter is entered on a later run. */
function takeIn(homeserver: Homeserver, records: RoomRecords, room: ActualRoom): Change {
    return {
        what: `take in the room ${room.id}`,
        run: async () => {
            await records.takeIn(room.id)
            await homeserver.takeRoomAdmin(room.id)
        },
    }
}

/** The room is left as its makers had it: without the level the sync gave, and without the bot. */
function giveBack(homeserver: Homeserver, records: RoomRecords, room: ActualRoom): Change {
    return {
        what: `give back the room ${room.id}`,
        run: async () => {
            if (room.members.includes(homeserver.botUserId)) {
                const users = roomLevelsOf(room.levels.users ?? {}, [])
                Reflect.deleteProperty(users, homeserver.botUserId)
                await homeserver.writeState(room.id, 'm.room.power_levels', { ...room.levels, users })
                await homeserver.leave(room.id)
            }
            await records.forget(room.id)
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

/** The admins of a room are set from the run after it is taken in, once the bot is in it. */
function setRoomAdmins(homeserver: Homeserver, room: ActualRoom, wanted: WantedSpace): Change[] {
    if (!room.members.includes(homeserver.botUserId)) {
        return [{
            what: `enter the room ${room.id}`,
            run: () => homeserver.takeRoomAdmin(room.id),
        }]
    }
    const adminsToGiveALevel = wanted.admins.filter(userId => !room.creators.includes(userId))
    const levels = roomLevelsOf(room.levels.users ?? {}, adminsToGiveALevel)
    if (sameLevels(room.levels.users ?? {}, levels)) return []
    return [{
        what: `set the admins of the room ${room.id}`,
        run: () => homeserver.writeState(room.id, 'm.room.power_levels', { ...room.levels, users: levels }),
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
