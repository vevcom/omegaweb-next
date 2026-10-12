import '@pn-server-only'
import { ServiceError } from '@/services/error'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * Moves a Feide account from a freshly created user onto a migrated user that has no
 * way of logging in yet, and deletes the fresh user. This is how a user whose Feide
 * email/username no longer matches their migrated user claims that user.
 *
 * The fresh user must have been created by a Feide login and not have completed registration
 * (no credentials, terms not accepted), so a user holding real data - such as a migrated user
 * that a Feide login was linked to by email - can never be deleted, and the target must be
 * unclaimed (no Feide account, no credentials), so an already linked user can never be
 * hijacked. Both checks run inside the transaction that performs the move.
 *
 * The fresh user's session dies on its own: the JWT decode requires the user's Feide
 * account to still exist, and it has been moved away.
 */
export async function moveFeideAccountToUser(
    prisma: PrismaClient,
    { fromUserId, toUserId, feideAccountId }: {
        fromUserId: number,
        toUserId: number,
        // When given, the move only happens if this is the Feide account the source user holds.
        feideAccountId?: string,
    },
): Promise<void> {
    if (fromUserId === toUserId) {
        throw new ServiceError('BAD PARAMETERS', 'Kan ikke flytte en Feide-konto til brukeren den allerede er på.')
    }

    await prisma.$transaction(async transaction => {
        const fromUser = await transaction.user.findUniqueOrThrow({
            where: { id: fromUserId },
            select: {
                acceptedTerms: true,
                createdByFeideLoginOnProjectNext: true,
                credentials: { select: { userId: true } },
                feideAccount: { select: { id: true } },
            },
        })

        if (!fromUser.feideAccount) {
            throw new ServiceError('BAD PARAMETERS', 'Brukeren har ingen Feide-konto å flytte.')
        }

        if (feideAccountId !== undefined && fromUser.feideAccount.id !== feideAccountId) {
            throw new ServiceError('BAD PARAMETERS', 'Brukeren har ikke lenger denne Feide-kontoen.')
        }

        if (!fromUser.createdByFeideLoginOnProjectNext) {
            throw new ServiceError(
                'BAD PARAMETERS',
                'Feide-kontoen kan bare flyttes fra en bruker som ble opprettet ved Feide-innloggingen.'
            )
        }

        if (fromUser.credentials || fromUser.acceptedTerms) {
            throw new ServiceError(
                'BAD PARAMETERS',
                'Feide-kontoen kan bare flyttes fra en bruker som ikke har fullført registreringen.'
            )
        }

        const toUser = await transaction.user.findUniqueOrThrow({
            where: { id: toUserId },
            select: {
                credentials: { select: { userId: true } },
                feideAccount: { select: { id: true } },
            },
        })

        if (toUser.feideAccount || toUser.credentials) {
            throw new ServiceError('BAD PARAMETERS', 'Målbrukeren er allerede koblet til en innlogging.')
        }

        await transaction.feideAccount.update({
            where: { userId: fromUserId },
            data: { userId: toUserId },
        })

        const deletedUser = await transaction.user.delete({
            where: { id: fromUserId },
            select: { bioParagraphId: true },
        })
        await transaction.cmsParagraph.delete({
            where: { id: deletedUser.bioParagraphId },
        })
    })
}
