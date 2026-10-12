import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { prismaCall } from '@/services/prismaCall'
import { readJWTPayload } from '@/jwt/jwtReadUnsecure'
import { ServiceError } from '@/services/error'
import type { Account } from 'next-auth'

export async function updateFeideAccount(
    accountId: string,
    account: Account,
): Promise<boolean> {
    if (account.provider !== 'feide') {
        throw new ServiceError('UNKNOWN ERROR', 'Tried to update feide account with data for a non feide account.')
    }

    if (!account.expires_at || !account.id_token) {
        throw new Error('Missing required fields in account')
    }

    const tokenData = readJWTPayload(account.id_token)

    const expiresAt = new Date(account.expires_at * 1000)
    const issuedAt = new Date(tokenData.iat * 1000)

    await prismaCall(() => prisma.feideAccount.update({
        where: {
            id: accountId
        },
        data: {
            expiresAt,
            issuedAt,
        }
    }))

    // TODO: If the query fails maybe the user is not connected to feide account

    return true
}

export async function updateEmailForFeideAccount(accountId: string, email: string): Promise<void> {
    await prismaCall(() => prisma.feideAccount.update({
        where: {
            id: accountId
        },
        data: {
            email
        }
    }))
}
