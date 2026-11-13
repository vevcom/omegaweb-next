import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import type { Homeserver } from './client'
import type { SyncReport } from './report'

const nameOf = (user: { firstname: string, lastname: string }) => `${user.firstname} ${user.lastname}`

/**
 * Gives every account the name its user has here. `ChatUser.syncedName` is the name the account
 * was last given, so only a changed name is sent. An account is made by the chat's sign in, some
 * time after its ChatUser, and one that is not there yet is left for a later run.
 */
export async function syncNames(homeserver: Homeserver, report: SyncReport): Promise<void> {
    const chatUsers = await prisma.chatUser.findMany({
        where: { deactivatedAt: null, user: { isNot: null } },
        select: { id: true, localpart: true, syncedName: true, user: { select: { firstname: true, lastname: true } } },
    })
    for (const { id, localpart, syncedName, user } of chatUsers) {
        const name = nameOf(user!)
        if (syncedName === name) continue
        const userId = homeserver.userIdOf(localpart)
        const hasAccount = await homeserver.hasAccount(userId).catch((error: unknown) => {
            report.refuse(`look up ${userId}`, error)
            return false
        })
        if (!hasAccount) continue

        await report.carryOut({
            what: `name ${userId}`,
            run: async () => {
                await homeserver.writeDisplayName(userId, name)
                await prisma.chatUser.update({ where: { id }, data: { syncedName: name } })
            },
        })
    }
}

/**
 * Deactivates the accounts of deleted users. A deleted user's ChatUser stays, without a user, see
 * chat.prisma: that is what says the account is to go. The row is then marked, and kept, so its
 * localpart is never given to another user.
 */
export async function deactivateAccountsOfDeletedUsers(homeserver: Homeserver, report: SyncReport): Promise<void> {
    const leftBehind = await prisma.chatUser.findMany({
        where: { userId: null, deactivatedAt: null },
        select: { id: true, localpart: true },
    })
    for (const { id, localpart } of leftBehind) {
        await report.carryOut({
            what: `deactivate ${homeserver.userIdOf(localpart)}`,
            run: async () => {
                await homeserver.deactivate(localpart)
                await prisma.$transaction([
                    prisma.chatSpaceMember.deleteMany({ where: { chatUserId: id } }),
                    prisma.chatUser.update({ where: { id }, data: { deactivatedAt: new Date() } }),
                ])
            },
        })
    }
}
