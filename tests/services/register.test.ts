import { Session } from '@/auth/session/Session'
import { userOperations } from '@/services/users/operations'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
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

    test('subscribes once to each default channel, keeping subscriptions the user already has', async () => {
        const { user, session } = await createUnregisteredUser('registerkeepssubscriptions', new Date().toISOString())
        const defaultChannels = await notificationChannelOperations.readDefault({ bypassAuth: true })
        expect(defaultChannels.length).toBeGreaterThan(0)

        await notificationSubscriptionOperations.createDefault.internalCall({ params: { userId: user.id } })
        await prisma.notificationSubscription.delete({
            where: { userId_channelId: { userId: user.id, channelId: defaultChannels[0].id } },
        })

        await userOperations.register({
            params: { id: user.id },
            data: registrationData,
            session,
        })

        const subscribedChannelIds = (await prisma.notificationSubscription.findMany({
            where: { userId: user.id },
            select: { channelId: true },
        })).map(subscription => subscription.channelId)
        expect(subscribedChannelIds.sort()).toEqual(defaultChannels.map(channel => channel.id).sort())
    })
})
