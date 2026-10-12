import '@pn-server-only'
import { prismaCall } from '@/services/prismaCall'
import { prisma } from '@/prisma-pn-client-instance'
import type { User } from '@/prisma-generated-pn-types'

/**
 * Reads the user associated with a feide account. Returns null if feide
 * account does not exist.
 *
 * @param feideAccountId - The id of the feide account model in the db.
 * @returns The user object associated with the feide account or null.
 */
export async function readUserOrNullOfFeideAccount(feideAccountId: string): Promise<User | null> {
    const feideAccount = await prismaCall(() => prisma.feideAccount.findUnique({
        where: {
            id: feideAccountId,
        },
        select: {
            user: true,
        },
    }))

    return feideAccount && feideAccount.user
}
