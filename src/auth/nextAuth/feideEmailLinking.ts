import '@pn-server-only'
import { feideRealmsLinkableByEmail } from '@/lib/feide/ConfigVars'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * Next auth links a Feide login that has no Feide account yet to the user the adapter finds by
 * email. That is only allowed when the Feide user studies at a trusted institution and the user has
 * neither a password nor another Feide account. Otherwise the email alone would hand over the user.
 *
 * `readRealms` reads the institutions of the Feide user's study programmes. It costs a call to Feide,
 * so it is only made when there is a user to link to.
 */
export async function feideLoginMayLinkByEmail(prisma: PrismaClient, {
    providerAccountId,
    email,
    readRealms,
}: {
    providerAccountId: string,
    email: string | undefined | null,
    readRealms: () => Promise<string[]>,
}) {
    const feideAccount = await prisma.feideAccount.findUnique({
        where: { id: providerAccountId },
        select: { id: true },
    })
    if (feideAccount || !email) return true

    const userByEmail = await prisma.user.findFirst({
        where: { OR: [{ email }, { feideAccount: { email } }] },
        select: {
            credentials: { select: { userId: true } },
            feideAccount: { select: { id: true } },
        },
    })
    if (!userByEmail) return true
    if (userByEmail.credentials || userByEmail.feideAccount) return false

    const realms = await readRealms()
    return realms.some(realm => feideRealmsLinkableByEmail.includes(realm))
}
