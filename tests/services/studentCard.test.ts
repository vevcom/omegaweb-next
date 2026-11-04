import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { userOperations } from '@/services/users/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

function sessionOf(user: UserFiltered | null, permissions: Permission[] = []) {
    return Session.fromJsObject({ memberships: [], permissions, user })
}

async function createUserWithCard(username: string) {
    return prisma.user.create({
        data: {
            username,
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            studentCard: `card-${username}`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
}

const studentCardOf = async (userId: number) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { studentCard: true } })).studentCard

describe('disconnecting a student card', () => {
    test('the owner can disconnect their own card', async () => {
        const owner = await createUserWithCard('cardowner')

        await userOperations.disconnectStudentCard({ params: { id: owner.id }, session: sessionOf(owner) })

        expect(await studentCardOf(owner.id)).toBeNull()
    })

    test('a user admin can disconnect someone else\'s card', async () => {
        const owner = await createUserWithCard('cardlost')
        const admin = await createUserWithCard('cardadmin')

        await userOperations.disconnectStudentCard({
            params: { id: owner.id },
            session: sessionOf(admin, ['USERS_ADMIN']),
        })

        expect(await studentCardOf(owner.id)).toBeNull()
    })

    test('another user cannot disconnect the card', async () => {
        const owner = await createUserWithCard('cardkept')
        const other = await createUserWithCard('cardother')

        await expect(userOperations.disconnectStudentCard({ params: { id: owner.id }, session: sessionOf(other) }))
            .rejects.toThrow(Smorekopp)

        expect(await studentCardOf(owner.id)).toBe('card-cardkept')
    })
})
