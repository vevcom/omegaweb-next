import { omegaquoteOperations } from '@/services/omegaquotes/operations'
import { userOperations } from '@/services/users/operations'
import { testSession } from 'tests/utils'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { UserFiltered } from '@/services/users/types'

let poster: UserFiltered
let other: UserFiltered

beforeAll(async () => {
    // The poster is made last, so that no id written into the operation by hand is the poster's.
    other = await createTestUser('contract-other')
    poster = await createTestUser('contract-poster')
})

describe('an operation made from a contract entry runs the rule of its entry', () => {
    const quote = { quote: 'Det ordner seg', author: 'Kongen' }

    test('with the data authorizerData gives it', async () => {
        const session = testSession({ user: poster, permissions: ['OMEGAQUOTES_USE'] })

        await expect(omegaquoteOperations.create({ params: { userPosterId: poster.id }, data: quote, session }))
            .resolves.toMatchObject({ ...quote, userPosterId: poster.id })
    })

    test('and refuses another user', async () => {
        const session = testSession({ user: other, permissions: ['OMEGAQUOTES_USE'] })

        await expect(omegaquoteOperations.create({ params: { userPosterId: poster.id }, data: quote, session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
    })

    test('and a user without the permission', async () => {
        const session = testSession({ user: poster, permissions: [] })

        await expect(omegaquoteOperations.create({ params: { userPosterId: poster.id }, data: quote, session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
    })

    test('and a visitor who is not signed in', async () => {
        const session = testSession({ permissions: ['OMEGAQUOTES_USE'] })

        await expect(omegaquoteOperations.create({ params: { userPosterId: poster.id }, data: quote, session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })
})

function createTestUser(username: string) {
    return userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
}
