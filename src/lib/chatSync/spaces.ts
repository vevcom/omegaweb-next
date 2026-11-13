import '@pn-server-only'
import { planEmptying, planSpaceChanges, roomsThatAre } from './spaceChanges'
import { chatSpaceAdmins } from '@/services/chat/spaces/admins'
import { prisma } from '@/prisma-pn-client-instance'
import type { ActualRoom, ActualSpace, RoomRecords, WantedSpace } from './spaceChanges'
import type { Homeserver, ListedRoom } from './client'
import type { SyncReport } from './report'
import type { ChatSpace } from '@/prisma-generated-pn-types'

/**
 * Makes every space on the homeserver what its row says. The rooms of a space are their makers':
 * the sync creates none, and in one that is handed over to the space it only decides who the
 * admins are.
 */
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
    const roomId = space.matrixRoomId ?? await createSpace(homeserver, space)

    const admins = await readAdmins(space)
    await keepAsMembers(space, admins)

    const wanted = await readWantedSpace(homeserver, space, admins)
    const actual = await readActualSpace(homeserver, space, roomId)

    await report.carryOutAll(planSpaceChanges(homeserver, roomRecordsOf(space), wanted, actual))
}

/**
 * A destroyed space is emptied, left by the bot with the rooms it holds, and then forgotten, the
 * records of its rooms with it. Until it is empty the row stays.
 */
async function destroySpace(homeserver: Homeserver, space: ChatSpace, report: SyncReport): Promise<void> {
    if (space.matrixRoomId !== null) {
        const actual = await readActualSpace(homeserver, space, space.matrixRoomId)

        const emptied = await report.carryOutAll(planEmptying(homeserver, actual))
        if (!emptied) return

        const roomsTheBotIsIn = roomsThatAre('HELD', actual).filter(room => room.members.includes(homeserver.botUserId))
        for (const room of roomsTheBotIsIn) await homeserver.leave(room.id)
        await homeserver.leave(actual.roomId)
    }
    await prisma.chatSpace.delete({ where: { id: space.id } })
}

async function createSpace(homeserver: Homeserver, space: ChatSpace): Promise<string> {
    const roomId = await homeserver.createSpace(space.name)
    await prisma.chatSpace.update({ where: { id: space.id }, data: { matrixRoomId: roomId } })
    return roomId
}

type Admin = { id: number }

/** The ChatUsers of a space's admins, whom the service that owns the space names. */
async function readAdmins(space: ChatSpace): Promise<Admin[]> {
    const userIds = await chatSpaceAdmins[space.purpose]?.({ prisma, spaceId: space.id }) ?? []
    return prisma.chatUser.findMany({
        where: { userId: { in: userIds }, deactivatedAt: null },
        select: { id: true },
    })
}

/** An admin is a member. So one who stops being an admin stays in the space, until they are removed. */
async function keepAsMembers(space: ChatSpace, admins: Admin[]): Promise<void> {
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

    return {
        name: space.name,
        members: members.map(userIdOf),
        admins: members.filter(member => adminIds.includes(member.chatUserId)).map(userIdOf),
    }
}

async function readActualSpace(homeserver: Homeserver, space: ChatSpace, roomId: string): Promise<ActualSpace> {
    const { name, levels, rooms: listed } = await homeserver.readSpace(roomId)
    const members = await homeserver.readJoinedMembers(roomId)

    return {
        roomId,
        name,
        members: members.filter(userId => userId !== homeserver.botUserId),
        levels,
        rooms: await readRooms(homeserver, space, listed),
    }
}

/** The rooms the space lists, and those it has taken in and lists no longer. */
async function readRooms(homeserver: Homeserver, space: ChatSpace, listed: ListedRoom[]): Promise<ActualRoom[]> {
    const listedIds = listed.map(room => room.id)
    const records = await prisma.chatSpaceRoom.findMany({
        where: { OR: [{ spaceId: space.id }, { matrixRoomId: { in: listedIds } }] },
        select: { matrixRoomId: true, spaceId: true },
    })
    const takenIn = records.filter(record => record.spaceId === space.id).map(record => record.matrixRoomId)
    const takenIntoOf = (roomId: string): ActualRoom['takenInto'] => {
        if (takenIn.includes(roomId)) return 'THIS_SPACE'
        return records.some(record => record.matrixRoomId === roomId) ? 'ANOTHER_SPACE' : null
    }

    const rooms: ActualRoom[] = []
    for (const id of Array.from(new Set([...listedIds, ...takenIn]))) {
        rooms.push({
            id,
            listedBy: listed.find(room => room.id === id)?.listedBy ?? null,
            takenInto: takenIntoOf(id),
            ...await homeserver.readRoom(id),
        })
    }
    return rooms
}

function roomRecordsOf(space: ChatSpace): RoomRecords {
    return {
        takeIn: roomId => prisma.chatSpaceRoom.create({ data: { spaceId: space.id, matrixRoomId: roomId } }),
        forget: roomId => prisma.chatSpaceRoom.deleteMany({ where: { spaceId: space.id, matrixRoomId: roomId } }),
    }
}
