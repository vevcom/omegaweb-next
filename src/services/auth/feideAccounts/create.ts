import '@pn-server-only'
import { prismaCall } from '@/services/prismaCall'
import { prisma } from '@/prisma-pn-client-instance'
import type { FeideAccount } from '@/prisma-generated-pn-types'

/**
 * Links a Feide account to a user. The Feide access token is only needed during sign-in, where it
 * is read from the OAuth account, so it is never stored.
 */
export async function createFeideAccount({
    id,
    expiresAt,
    issuedAt,
    userId,
    email,
}: FeideAccount): Promise<FeideAccount> {
    return await prismaCall(() => prisma.feideAccount.create({
        data: {
            id,
            expiresAt,
            issuedAt,
            email,
            user: {
                connect: {
                    id: userId,
                },
            }
        }
    }))
}
