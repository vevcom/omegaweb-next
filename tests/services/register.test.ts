import { Session } from '@/auth/session/Session'
import { userOperations } from '@/services/users/operations'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { ServiceError } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { describe, expect, jest, test } from '@jest/globals'

async function createUnregisteredUser(username: string, emailVerified: string | null) {
    const user = await userOperations.create({
        data: {
            email: `${username}@example.com`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified,
        },
        bypassAuth: true,
    })

    return {
        user,
        session: Session.fromJsObject({ user, permissions: [], memberships: [] }),
    }
}

const registrationData = {
    password: 'EtVeldigLangtPassord1',
    confirmPassword: 'EtVeldigLangtPassord1',
    acceptedTerms: true,
}

describe('register', () => {
    test('refuses a user whose email is not verified', async () => {
        const { user, session } = await createUnregisteredUser('registerunverified', null)

        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })

        const stored = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { acceptedTerms: true, credentials: true },
        })
        expect(stored.acceptedTerms).toBeNull()
        expect(stored.credentials).toBeNull()
    })

    test('registers a user whose email is verified', async () => {
        const { user, session } = await createUnregisteredUser('registerverified', new Date().toISOString())

        await userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })

        const stored = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { acceptedTerms: true },
        })
        expect(stored.acceptedTerms).not.toBeNull()
    })

    test('rolls back everything when a later step fails, so the user can try again', async () => {
        const { user, session } = await createUnregisteredUser('registerrollback', new Date().toISOString())

        const writeUserLevel = jest.spyOn(omegaMembershipGroupOperations.writeUserLevel, 'internalCall')
            .mockRejectedValueOnce(new ServiceError('SERVER ERROR', 'level step failed'))
        await expect(userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })).rejects.toMatchObject({ errorCode: 'SERVER ERROR' })
        writeUserLevel.mockRestore()

        const rolledBack = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { acceptedTerms: true, credentials: true, notificationSubscriptions: true },
        })
        expect(rolledBack.acceptedTerms).toBeNull()
        expect(rolledBack.credentials).toBeNull()
        expect(rolledBack.notificationSubscriptions).toEqual([])

        await userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })

        const registered = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { acceptedTerms: true },
        })
        expect(registered.acceptedTerms).not.toBeNull()
    })

    test('subscribes to no channel, so a new user hears nothing until they turn a channel on', async () => {
        const { user, session } = await createUnregisteredUser('registernosubscriptions', new Date().toISOString())
        expect((await notificationChannelOperations.readDefault({ bypassAuth: true })).length).toBeGreaterThan(0)

        await userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })

        expect(await prisma.notificationSubscription.findMany({ where: { userId: user.id } })).toEqual([])
    })

    test('keeps a subscription the user already has, as one whose accepted terms were reset does', async () => {
        const { user, session } = await createUnregisteredUser('registerkeepssubscription', new Date().toISOString())
        const channel = (await notificationChannelOperations.readDefault({ bypassAuth: true }))[0]
        await prisma.notificationSubscription.create({
            data: {
                user: { connect: { id: user.id } },
                channel: { connect: { id: channel.id } },
                methods: { create: { email: true, emailWeekly: false, push: false } },
            },
        })

        await userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })

        const subscriptions = await prisma.notificationSubscription.findMany({ where: { userId: user.id } })
        expect(subscriptions.map(subscription => subscription.channelId)).toEqual([channel.id])
    })
})
