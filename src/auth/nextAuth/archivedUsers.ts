import '@pn-server-only'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * Whether a login reaches an archived user. A password login is matched by user id, and a Feide
 * login by its linked Feide account or by email. The adapter treats archived users as missing, so
 * without this check next auth would try to create a user with their email and fail on the unique
 * constraint.
 */
export async function loginReachesArchivedUser(prisma: PrismaClient, {
    userId,
    feideAccountId,
    email,
}: {
    userId?: number,
    feideAccountId?: string,
    email?: string | null,
}) {
    const archivedUser = await prisma.user.findFirst({
        where: {
            archived: true,
            OR: [
                ...(userId !== undefined ? [{ id: userId }] : []),
                ...(feideAccountId ? [{ feideAccount: { id: feideAccountId } }] : []),
                ...(email ? [{ email }, { feideAccount: { email } }] : []),
            ],
        },
        select: { id: true },
    })
    return archivedUser !== null
}
