import '@pn-server-only'
import { planEmptying, planSpaceChanges } from './spaceChanges'
import { chatSpaceAdmins } from '@/services/chat/spaces/admins'
import { prisma } from '@/prisma-pn-client-instance'
import type { ActualSpace, WantedSpace } from './spaceChanges'
import type { Homeserver } from './client'
import type { SyncReport } from './report'
import type { ChatSpace } from '@/prisma-generated-pn-types'

/**
 * Makes every space on the homeserver what its row says. The rooms of a space are their makers':
 * the sync creates none, and in one it only decides who the space's admins are.
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
    const actual = await readActualSpace(homeserver, roomId)

    await report.carryOutAll(planSpaceChanges(homeserver, wanted, actual))
}

/** A destroyed space is emptied, left by the bot with its rooms, and then forgotten. Until it is empty the row stays. */
async function destroySpace(homeserver: Homeserver, space: ChatSpace, report: SyncReport): Promise<void> {
    if (space.matrixRoomId !== null) {
        const actual = await readActualSpace(homeserver, space.matrixRoomId)

        const emptied = await report.carryOutAll(planEmptying(homeserver, actual))
        if (!emptied) return

        for (const room of actual.rooms) if (room.entered) await homeserver.leave(room.id)
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

async function readActualSpace(homeserver: Homeserver, roomId: string): Promise<ActualSpace> {
    const { name, levels, roomIds } = await homeserver.readSpace(roomId)
    const members = await homeserver.readJoinedMembers(roomId)

    const rooms = []
    for (const id of roomIds) rooms.push({ id, entered: await homeserver.readRoom(id) })

    return {
        roomId,
        name,
        members: members.filter(userId => userId !== homeserver.botUserId),
        levels,
        rooms,
    }
}
