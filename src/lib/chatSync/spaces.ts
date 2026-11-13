import '@pn-server-only'
import { planSpaceChanges, removeEveryoneBut } from './spaceChanges'
import { chatSpaceAdmins } from '@/services/chat/spaces/admins'
import { prisma } from '@/prisma-pn-client-instance'
import type { ActualRoom, ActualSpace, WantedRoom, WantedSpace } from './spaceChanges'
import type { Homeserver } from './client'
import type { SyncReport } from './report'
import type { ChatSpace, ChatSpaceRoom } from '@/prisma-generated-pn-types'

export async function syncSpaces(homeserver: Homeserver, report: SyncReport): Promise<void> {
    const spaces = await prisma.chatSpace.findMany({ orderBy: { id: 'asc' } })
    for (const space of spaces) {
        try {
            if (space.destroyedAt) await destroySpace(homeserver, space, report)
            else await syncSpace(homeserver, space, report)
        } catch (error) {
            report.refuse(`sync the space ${space.name}`, error)
        }
    }
}

async function syncSpace(homeserver: Homeserver, space: ChatSpace, report: SyncReport): Promise<void> {
    const spaceRoomId = space.matrixRoomId ?? await createSpace(homeserver, space)

    await destroyRoomsMarkedDestroyed(homeserver, space, spaceRoomId, report)
    await createRoomsNotYetMade(homeserver, space, spaceRoomId, report)

    const admins = await readAdmins(space)
    await makeAdminsMembers(space, admins)

    const wanted = await readWantedSpace(homeserver, space, admins)
    const actual = await readActualSpace(homeserver, spaceRoomId, wanted.rooms, report)

    await report.carryOutAll(planSpaceChanges(homeserver, wanted, actual))
}

/** The row stays until the space and its rooms are emptied, so a later run takes up what this one could not do. */
async function destroySpace(homeserver: Homeserver, space: ChatSpace, report: SyncReport): Promise<void> {
    if (space.matrixRoomId !== null) {
        const emptied = await tryToEmptyAndLeave(homeserver, space.matrixRoomId, report)
        if (!emptied) return

        const rooms = await prisma.chatSpaceRoom.findMany({ where: { spaceId: space.id } })
        for (const room of rooms) {
            const destroyed = await tryToDestroyRoom(homeserver, room, report)
            if (!destroyed) return
        }
    }
    await prisma.chatSpace.delete({ where: { id: space.id } })
}

async function destroyRoomsMarkedDestroyed(
    homeserver: Homeserver,
    space: ChatSpace,
    spaceRoomId: string,
    report: SyncReport,
): Promise<void> {
    const rooms = await prisma.chatSpaceRoom.findMany({ where: { spaceId: space.id, destroyedAt: { not: null } } })
    for (const room of rooms) {
        const { matrixRoomId } = room
        const unlisted = matrixRoomId === null || await report.carryOut({
            what: `unlist ${matrixRoomId}`,
            run: () => homeserver.unlistRoom(spaceRoomId, matrixRoomId),
        })
        if (unlisted) await tryToDestroyRoom(homeserver, room, report)
    }
}

async function tryToDestroyRoom(homeserver: Homeserver, room: ChatSpaceRoom, report: SyncReport): Promise<boolean> {
    if (room.matrixRoomId !== null) {
        const emptied = await tryToEmptyAndLeave(homeserver, room.matrixRoomId, report)
        if (!emptied) return false
    }
    await prisma.chatSpaceRoom.delete({ where: { id: room.id } })
    return true
}

async function tryToEmptyAndLeave(homeserver: Homeserver, roomId: string, report: SyncReport): Promise<boolean> {
    const room = await homeserver.readRoom(roomId)
    // The bot left it on an earlier run.
    if (!room) return true

    const { invitedUserIds } = room
    const membersWithoutBot = withoutBot(homeserver, room.joinedUserIds)
    const emptied = await report.carryOutAll(
        removeEveryoneBut([], homeserver, { id: roomId, membersWithoutBot, invitedUserIds })
    )
    if (!emptied) return false
    return report.carryOut({ what: `leave ${roomId}`, run: () => homeserver.leave(roomId) })
}

async function createSpace(homeserver: Homeserver, space: ChatSpace): Promise<string> {
    const roomId = await homeserver.createSpace(space.name)
    await prisma.chatSpace.update({ where: { id: space.id }, data: { matrixRoomId: roomId } })
    return roomId
}

async function createRoomsNotYetMade(
    homeserver: Homeserver,
    space: ChatSpace,
    spaceRoomId: string,
    report: SyncReport,
): Promise<void> {
    const rooms = await prisma.chatSpaceRoom.findMany({
        where: { spaceId: space.id, matrixRoomId: null, destroyedAt: null },
        orderBy: { id: 'asc' },
    })
    for (const room of rooms) {
        await report.carryOut({
            what: `make the room ${room.name}`,
            run: async () => {
                const { name, isPrivate } = room
                const matrixRoomId = await homeserver.createRoom({ name, spaceRoomId, isPrivate })
                await prisma.chatSpaceRoom.update({ where: { id: room.id }, data: { matrixRoomId } })
            },
        })
    }
}

type Admin = { id: number }

async function readAdmins(space: ChatSpace): Promise<Admin[]> {
    const userIds = await chatSpaceAdmins[space.purpose]?.({ prisma, spaceId: space.id }) ?? []
    return prisma.chatUser.findMany({
        where: { userId: { in: userIds }, deactivatedAt: null },
        select: { id: true },
    })
}

async function makeAdminsMembers(space: ChatSpace, admins: Admin[]): Promise<void> {
    await prisma.chatSpaceMember.createMany({
        data: admins.map(admin => ({ spaceId: space.id, chatUserId: admin.id })),
        skipDuplicates: true,
    })
}

async function readWantedSpace(homeserver: Homeserver, space: ChatSpace, admins: Admin[]): Promise<WantedSpace> {
    const adminIds = admins.map(admin => admin.id)
    const members = await prisma.chatSpaceMember.findMany({
        where: {
            spaceId: space.id,
            chatUser: {
                deactivatedAt: null,
                user: { archived: false },
                // An account that has been given no name is not on the homeserver yet, see accounts.ts.
                syncedName: { not: null },
            },
        },
        select: { chatUserId: true, chatUser: { select: { localpart: true } } },
    })
    const userIdOf = (member: typeof members[number]) => homeserver.userIdOf(member.chatUser.localpart)
    const memberUserIds = members.map(userIdOf)

    return {
        name: space.name,
        members: memberUserIds,
        admins: members.filter(member => adminIds.includes(member.chatUserId)).map(userIdOf),
        rooms: await readWantedRooms(homeserver, space, memberUserIds),
    }
}

async function readWantedRooms(homeserver: Homeserver, space: ChatSpace, memberUserIds: string[]): Promise<WantedRoom[]> {
    const rooms = await prisma.chatSpaceRoom.findMany({
        where: { spaceId: space.id, destroyedAt: null },
        select: {
            matrixRoomId: true,
            name: true,
            isPrivate: true,
            pickedMembers: { select: { spaceMember: { select: { chatUser: { select: { localpart: true } } } } } },
        },
        orderBy: { id: 'asc' },
    })
    return rooms.flatMap(({ matrixRoomId, name, isPrivate, pickedMembers }) => {
        if (matrixRoomId === null) return []
        const pickedUserIds = pickedMembers.map(({ spaceMember }) => homeserver.userIdOf(spaceMember.chatUser.localpart))
        return [{
            id: matrixRoomId,
            name,
            isPrivate,
            pickedMembers: pickedUserIds.filter(userId => memberUserIds.includes(userId)),
        }]
    })
}

async function readActualSpace(
    homeserver: Homeserver,
    spaceRoomId: string,
    wantedRooms: WantedRoom[],
    report: SyncReport,
): Promise<ActualSpace> {
    const space = await homeserver.readRoom(spaceRoomId)
    if (!space) throw new Error(`The bot cannot read the space ${spaceRoomId}`)

    const rooms: ActualRoom[] = []
    for (const { id } of wantedRooms) {
        const room = await homeserver.readRoom(id)
        if (!room) {
            report.refuse(`read the room ${id}`, 'the bot is not in it')
            continue
        }
        rooms.push({
            id,
            name: room.name,
            membersWithoutBot: withoutBot(homeserver, room.joinedUserIds),
            invitedUserIds: room.invitedUserIds,
            levels: room.levels,
        })
    }

    return {
        id: spaceRoomId,
        name: space.name,
        membersWithoutBot: withoutBot(homeserver, space.joinedUserIds),
        invitedUserIds: space.invitedUserIds,
        listedRoomIds: space.listedRoomIds,
        rooms,
    }
}

function withoutBot(homeserver: Homeserver, userIds: string[]): string[] {
    return userIds.filter(userId => userId !== homeserver.botUserId)
}
