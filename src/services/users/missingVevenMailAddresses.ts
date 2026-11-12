import '@pn-server-only'
import { userPartitions } from './constants'
import { vevenMailAddressOperations } from './vevenMailAddress'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'

/**
 * Gives every user who has no address on our mail domains the one they have by default, see
 * `vevenMailAddressOperations.internal.createDefault`. A user is given theirs when they are created, so this
 * is for those from before users had addresses, and for one whose creation could not give it. A
 * user who cannot be given one does not keep the others from theirs. Run by the mail worker
 * (src/workers/definitions.ts).
 *
 * @returns how many users were given an address.
 */
export async function giveMissingVevenMailAddresses(): Promise<number> {
    const users = await prisma.user.findMany({
        where: { ...userPartitions.unarchived, vevenMailAddress: null },
        select: { id: true, username: true },
        orderBy: { id: 'asc' },
    })
    let given = 0
    for (const user of users) {
        try {
            await vevenMailAddressOperations.internal.createDefault.internalCall({ params: { id: user.id } })
            given += 1
        } catch (error) {
            logger.error(`Could not give the user ${user.username} a mail address: ${error}`)
        }
    }
    if (given > 0) logger.info(`Gave ${given} users the mail address they have by default`)
    return given
}
