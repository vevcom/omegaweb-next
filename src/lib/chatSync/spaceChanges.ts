import { ROOM_ADMIN_LEVEL, ROOM_INVITE_LEVEL, SPACE_ADMIN_LEVEL } from './constants'
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
 * What a room is to the space. Only a HELD room is the space's, to set the levels of and to keep
 * to the members of the space.
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
    const held = roomsThatAre('HELD', actual)

    return [
        ...rename(homeserver, wanted, actual),
        ...roomsThatAre('HANDED_OVER', actual).map(room => takeIn(homeserver, records, room)),
        ...toAdd.map(userId => addMember(homeserver, actual, userId)),
        ...held.flatMap(room => keepToMembers(homeserver, room, wanted.members)),
        ...toRemove.map(userId => removeMember(homeserver, actual, userId)),
        ...setSpaceAdmins(homeserver, wanted, actual),
        ...held.flatMap(room => setRoomLevels(homeserver, room, wanted)),
        ...roomsThatAre('GIVEN_BACK', actual).map(room => giveBack(homeserver, records, room)),
    ]
}

/**
 * What it takes to get everyone out of a space and out of the rooms it holds. A room it was taken
 * out of is given back as it is, with those who are in it.
 */
export function planEmptying(homeserver: Homeserver, records: RoomRecords, actual: ActualSpace): Change[] {
    return [
        ...roomsThatAre('GIVEN_BACK', actual).map(room => giveBack(homeserver, records, room)),
        ...roomsThatAre('HELD', actual).flatMap(room => keepToMembers(homeserver, room, [])),
        ...actual.members.map(userId => removeMember(homeserver, actual, userId)),
    ]
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
 * Whether a room is a user's to hand over to a space: they are in it, and made it or could do by
 * hand what the sync does in a room a space holds, which is to change its levels and to raise
 * inviting to ROOM_INVITE_LEVEL. So the sync gives a space's admins nothing in a room that whoever
 * listed it could not have given them. A level outlives the membership it was given to, so one
 * who was taken out of the room hands over nothing.
 */
export function canHandOver(room: ChatRoom, userId: string): boolean {
    if (!room.members.includes(userId)) return false
    if (room.creators.includes(userId)) return true
    const { users = {}, users_default: usersDefault = 0, events = {}, state_default: stateDefault = 50 } = room.levels as {
        users?: UserLevels,
        users_default?: number,
        events?: Record<string, number>,
        state_default?: number,
    }
    const levelThatChangesLevels = events['m.room.power_levels'] ?? stateDefault
    return (users[userId] ?? usersDefault) >= Math.max(levelThatChangesLevels, ROOM_INVITE_LEVEL)
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

function removeMember(homeserver: Homeserver, actual: ActualSpace, userId: string): Change {
    return {
        what: `remove ${userId}`,
        run: () => homeserver.removeMember(actual.roomId, userId),
    }
}

/**
 * A room a space holds is for the members of the space, and whoever else is in it is taken out:
 * someone removed from the space, or let into the room from the chat. It is planned before the
 * removals from the space, since a room lets the members of its space in.
 */
function keepToMembers(homeserver: Homeserver, room: ActualRoom, spaceMembers: string[]): Change[] {
    return room.members
        .filter(userId => userId !== homeserver.botUserId && !spaceMembers.includes(userId))
        .map(userId => ({
            what: `remove ${userId} from the room ${room.id}`,
            run: () => homeserver.removeMember(room.id, userId),
        }))
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

/**
 * The room is left to its makers: without the level the sync gave, without the bot, and with
 * inviting at the level Matrix gives it when a room names none. What is left of the sync's in the
 * room tells how far an earlier run got, so one that was stopped halfway is taken up from there,
 * and a bot that is out of the room or without its level gets back in to take the levels it gave.
 * A room nobody is in has no one for a level to be held by, and is only forgotten.
 */
function giveBack(homeserver: Homeserver, records: RoomRecords, room: ActualRoom): Change {
    const users = room.levels.users ?? {}
    const botIsIn = room.members.includes(homeserver.botUserId)
    const botHasItsLevel = (users[homeserver.botUserId] ?? 0) >= ROOM_INVITE_LEVEL
    const hasLevelsToTake = room.members.length > 0
        && (homeserver.botUserId in users || Object.values(users).includes(ROOM_ADMIN_LEVEL))

    return {
        what: `give back the room ${room.id}`,
        run: async () => {
            if (hasLevelsToTake) {
                if (!botIsIn || !botHasItsLevel) await homeserver.takeRoomAdmin(room.id)
                await homeserver.writeState(room.id, 'm.room.power_levels', levelsGivenBack(homeserver, room))
            }
            if (botIsIn || hasLevelsToTake) await homeserver.leave(room.id)
            await records.forget(room.id)
        },
    }
}

function levelsGivenBack(homeserver: Homeserver, room: ActualRoom): ChatPowerLevels {
    const users = roomLevelsOf(room.levels.users ?? {}, [])
    Reflect.deleteProperty(users, homeserver.botUserId)
    const levels = { ...room.levels, users }
    Reflect.deleteProperty(levels, 'invite')
    return levels
}

function setSpaceAdmins(homeserver: Homeserver, wanted: WantedSpace, actual: ActualSpace): Change[] {
    const levels = spaceLevelsOf(wanted.admins)
    if (sameLevels(actual.levels.users ?? {}, levels)) return []
    return [{
        what: 'set the admins of the space',
        run: () => homeserver.writeState(actual.roomId, 'm.room.power_levels', { ...actual.levels, users: levels }),
    }]
}

/**
 * In a room a space holds, the space's admins are admins and only the bot invites. Set from the
 * run after the room is taken in, once the bot is in it.
 */
function setRoomLevels(homeserver: Homeserver, room: ActualRoom, wanted: WantedSpace): Change[] {
    if (!room.members.includes(homeserver.botUserId)) {
        return [{
            what: `enter the room ${room.id}`,
            run: () => homeserver.takeRoomAdmin(room.id),
        }]
    }
    const adminsToGiveALevel = wanted.admins.filter(userId => !room.creators.includes(userId))
    const users = roomLevelsOf(room.levels.users ?? {}, adminsToGiveALevel)
    if (sameLevels(room.levels.users ?? {}, users) && room.levels.invite === ROOM_INVITE_LEVEL) return []
    return [{
        what: `set the levels of the room ${room.id}`,
        run: () => homeserver.writeState(room.id, 'm.room.power_levels', {
            ...room.levels,
            invite: ROOM_INVITE_LEVEL,
            users,
        }),
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
