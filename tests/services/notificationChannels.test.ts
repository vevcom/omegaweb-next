import { prisma } from '@/prisma-pn-client-instance'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'
import { specialNotificationChannelOperations } from '@/services/notifications/channels/special/operations'
import { contactorNotificationChannel } from '@/services/careers/contactorNotificationChannel'
import { eventNotificationChannel } from '@/services/events/eventNotificationChannel'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { allNotificationMethodsOn } from '@/services/notifications/constants'
import { Smorekopp } from '@/services/error'
import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'

const createdChannelIds: number[] = []

afterEach(async () => {
    await Promise.all(createdChannelIds.map(id => manualNotificationChannelOperations.destroy({
        params: { id },
        bypassAuth: true,
    })))
    createdChannelIds.length = 0
})

async function readRoot() {
    return specialNotificationChannelOperations.channels.ROOT.readChannel({ bypassAuth: true })
}

async function createManualChannel(name: string, parentId: number) {
    const channel = await manualNotificationChannelOperations.create({
        params: { availableMethods: allNotificationMethodsOn },
        data: { name, description: 'A channel made in a test', parentId },
        bypassAuth: true,
    })
    createdChannelIds.push(channel.id)
    return channel
}

describe('the special and the manual notification channels', () => {
    test('a channel carries the purpose of the system that made it, and each system reads its own', async () => {
        const root = await readRoot()
        const manual = await createManualChannel('test-own-channels', root.id)
        expect(root.purpose).toBe('SPECIAL')
        expect(manual.purpose).toBe('MANUAL')

        const specials = await specialNotificationChannelOperations.readMany({ bypassAuth: true })
        expect(specials.every(channel => channel.purpose === 'SPECIAL')).toBe(true)
        expect(specials.map(channel => channel.id)).toContain(root.id)

        const manuals = await manualNotificationChannelOperations.readMany({ bypassAuth: true })
        expect(manuals.every(channel => channel.purpose === 'MANUAL')).toBe(true)
        expect(manuals.map(channel => channel.id)).toContain(manual.id)
        expect(manuals.map(channel => channel.id)).not.toContain(root.id)
    })

    test('a special channel is neither changed, deleted nor sent in through the manual system', async () => {
        const root = await readRoot()
        const disallowed = new Smorekopp('DISSALLOWED')

        await expect(manualNotificationChannelOperations.update({
            params: { id: root.id, availableMethods: allNotificationMethodsOn },
            data: { name: 'Renamed root', description: '', parentId: root.id, mailAliasId: root.mailAliasId },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        await expect(manualNotificationChannelOperations.destroy({
            params: { id: root.id },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        await expect(manualNotificationChannelOperations.createNotification({
            params: { channelId: root.id },
            data: { title: 'Not sent', message: 'This should never be created.' },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)

        expect((await readRoot()).name).toBe(root.name)
    })

    test('a manual channel may sit under a special one and be sent in', async () => {
        const root = await readRoot()
        const channel = await createManualChannel('test-under-special', root.id)
        expect(channel.parentId).toBe(root.id)

        await expect(manualNotificationChannelOperations.createNotification({
            params: { channelId: channel.id },
            data: { title: 'Sent in a manual channel', message: 'Nothing is created under IGNORE_SERVER_ONLY.' },
            bypassAuth: true,
        })).resolves.toEqual({ notification: null })
    })

    test('a notification takes its audience as requirements, which become a visibility of its own', async () => {
        const root = await readRoot()
        const channel = await createManualChannel('test-audience', root.id)
        const group = await prisma.group.findFirstOrThrow()
        const send = (requirements: { conditions: { type: 'ACTIVE', groupId: number }[] }[]) =>
            manualNotificationChannelOperations.createNotification({
                params: { channelId: channel.id },
                data: { title: 'To some', message: 'Only those in the group get this.', audience: { requirements } },
                bypassAuth: true,
            })

        await expect(send([{ conditions: [] }])).rejects.toThrow(new Smorekopp('BAD DATA'))

        // Notifications are not created under IGNORE_SERVER_ONLY, so it is lifted to see this one made.
        const ignoreServerOnly = process.env.IGNORE_SERVER_ONLY
        Reflect.deleteProperty(process.env, 'IGNORE_SERVER_ONLY')
        try {
            const { notification: toSome } = await send([{ conditions: [{ type: 'ACTIVE', groupId: group.id }] }])
            const { notification: toAll } = await send([])
            expect(toAll?.visibilityId).toBeNull()
            const visibility = await prisma.visibility.findUniqueOrThrow({
                where: { id: toSome?.visibilityId ?? -1 },
                include: { requirements: { include: { conditions: true } } },
            })
            expect(visibility.requirements.map(requirement => requirement.conditions.map(condition => condition.groupId)))
                .toEqual([[group.id]])

            // A channel with channels under it is not deleted, and then keeps its notifications as they were.
            const child = await createManualChannel('test-audience-child', channel.id)
            await expect(manualNotificationChannelOperations.destroy({ params: { id: channel.id }, bypassAuth: true }))
                .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
            expect(await prisma.visibility.findUnique({ where: { id: visibility.id } })).not.toBeNull()
            await manualNotificationChannelOperations.destroy({ params: { id: child.id }, bypassAuth: true })

            // Deleted, the channel takes its notifications and their visibilities with it.
            await manualNotificationChannelOperations.destroy({ params: { id: channel.id }, bypassAuth: true })
            createdChannelIds.length = 0
            expect(await prisma.visibility.findUnique({ where: { id: visibility.id } })).toBeNull()
            expect(await prisma.notification.count({ where: { id: { in: [toSome?.id ?? -1, toAll?.id ?? -1] } } })).toBe(0)
        } finally {
            if (ignoreServerOnly === undefined) Reflect.deleteProperty(process.env, 'IGNORE_SERVER_ONLY')
            else process.env.IGNORE_SERVER_ONLY = ignoreServerOnly
        }
    })

    test('a special channel is created from its config when it is missing', async () => {
        const before = await contactorNotificationChannel.readChannel({ bypassAuth: true })
        await prisma.notificationChannel.delete({ where: { id: before.id } })
        await prisma.notificationMethod.delete({ where: { id: before.availableMethodsId } })

        const recreated = await contactorNotificationChannel.readChannel({ bypassAuth: true })
        expect(recreated.id).not.toBe(before.id)
        expect(recreated).toMatchObject({
            special: 'CONTACTOR',
            purpose: 'SPECIAL',
            name: before.name,
            description: before.description,
            parentId: before.parentId,
            availableMethods: before.availableMethods,
        })
    })
})

describe('the channels an event owns', () => {
    const HOUR = 60 * 60 * 1000
    let eventId: number
    let userId: number
    const infoSpy = jest.spyOn(eventNotificationOperations.internal.createInfoNotification, 'internalCall')

    const readChannelsOfEvent = async (id: number) => {
        const event = await prisma.event.findUniqueOrThrow({
            where: { id },
            select: {
                notificationChannel: { include: { availableMethods: true } },
                infoNotificationChannel: { include: { availableMethods: true } },
                generalNotificationChannel: { include: { availableMethods: true } },
            },
        })
        return [event.notificationChannel, event.infoNotificationChannel, event.generalNotificationChannel]
    }

    beforeAll(async () => {
        const event = await eventOperations.create({
            data: {
                name: 'Event with channels',
                location: 'Here',
                eventStart: new Date(Date.now() + HOUR),
                eventEnd: new Date(Date.now() + 2 * HOUR),
                canBeViewedBy: 'ALL',
                takesRegistration: true,
                places: 5,
                takesPayment: true,
                price: 100,
                paymentStart: new Date(),
                paymentEnd: new Date(Date.now() + HOUR),
                waitingList: false,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        eventId = event.id
        const user = await userOperations.create({
            data: {
                email: 'channel-registrant@omega.ntnu.no',
                firstname: 'Kanal',
                lastname: 'Testesen',
                username: 'channelregistrant',
                emailVerified: new Date().toISOString(),
            },
            bypassAuth: true,
        })
        userId = user.id
    })

    afterAll(async () => {
        await prisma.user.delete({ where: { id: userId } })
    })

    afterEach(() => {
        infoSpy.mockClear()
    })

    test('an event is made with its three channels under the EVENT channel', async () => {
        const [own, info, general] = await readChannelsOfEvent(eventId)
        const parent = await eventNotificationChannel.readChannel({ bypassAuth: true })

        expect(own).toMatchObject({ purpose: 'EVENT', parentId: parent.id })
        expect(info).toMatchObject({ purpose: 'EVENT_INFO', parentId: own.id })
        expect(general).toMatchObject({ purpose: 'EVENT_GENERAL', parentId: own.id })
        expect(info.availableMethods.emailWeekly).toBe(false)
        expect(general.availableMethods).toMatchObject(parent.availableMethods)
    })

    test('registering subscribes to the info channel with every method it offers', async () => {
        await eventRegistrationOperations.createAsAdmin({ params: { userId, eventId }, bypassAuth: true })
        const [, info] = await readChannelsOfEvent(eventId)
        const subscription = await prisma.notificationSubscription.findUniqueOrThrow({
            where: { userId_channelId: { userId, channelId: info.id } },
            include: { methods: true },
        })
        expect(subscription.methods).toMatchObject({ email: true, emailWeekly: false, push: true })
    })

    test('the manual system reaches none of them', async () => {
        const [, info] = await readChannelsOfEvent(eventId)
        const disallowed = new Smorekopp('DISSALLOWED')

        await expect(manualNotificationChannelOperations.destroy({
            params: { id: info.id },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)
        await expect(manualNotificationChannelOperations.createNotification({
            params: { channelId: info.id },
            data: { title: 'Not sent', message: 'This should never be created.' },
            bypassAuth: true,
        })).rejects.toThrow(disallowed)
    })

    test('the organisers send in the general channel, and in no other channel of the event', async () => {
        const [, info, general] = await readChannelsOfEvent(eventId)
        const data = { title: 'To the registered', message: 'A message.', audience: { registeredForEventId: eventId } }

        await expect(eventNotificationOperations.createNotification({
            implementationParams: { eventId },
            params: { channelId: general.id },
            data,
            bypassAuth: true,
        })).resolves.toEqual({ notification: null })
        await expect(eventNotificationOperations.createNotification({
            implementationParams: { eventId },
            params: { channelId: info.id },
            data,
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('DISSALLOWED'))
    })

    test('a payment reminder goes to those holding an unpaid place, in the info channel', async () => {
        await eventNotificationOperations.createPaymentReminder({ params: { eventId }, bypassAuth: true })
        const [, info] = await readChannelsOfEvent(eventId)
        expect(infoSpy).toHaveBeenCalledTimes(1)
        expect(infoSpy).toHaveBeenCalledWith(expect.objectContaining({
            params: { channelId: info.id },
            data: expect.objectContaining({ audience: { userIds: [userId] } }),
        }))

        const registration = await prisma.eventRegistration.findFirstOrThrow({ where: { userId } })
        await eventRegistrationOperations.setManuallyPaid({
            params: { registrationId: registration.id },
            data: { manuallyPaid: true },
            bypassAuth: true,
        })
        await expect(eventNotificationOperations.createPaymentReminder({
            params: { eventId },
            bypassAuth: true,
        })).resolves.toEqual({ notification: null })
        expect(infoSpy).toHaveBeenCalledTimes(1)
    })

    test("an event's channels take no rows of their own: the parent's subscribers follow through them", async () => {
        const parent = await eventNotificationChannel.readChannel({ bypassAuth: true })
        await notificationSubscriptionOperations.update({
            params: { userId, channelId: parent.id },
            data: { email: true, emailWeekly: true, push: false },
            bypassAuth: true,
        })
        const created = await eventNotificationOperations.internal.createChannels.internalCall({
            params: { eventId },
            data: { name: 'test-inherited-subscribers' },
        })
        const ids = [created.notificationChannelId, created.infoNotificationChannelId, created.generalNotificationChannelId]
        expect(await prisma.notificationSubscription.count({ where: { channelId: { in: ids } } })).toBe(0)

        const resolved = await notificationSubscriptionOperations.read({ params: { userId }, bypassAuth: true })
        const of = (channelId: number) => resolved.find(subscription => subscription.channelId === channelId)
        expect(of(created.infoNotificationChannelId)).toEqual({
            channelId: created.infoNotificationChannelId,
            explicit: false,
            methods: { email: true, emailWeekly: false, push: false },
        })
        expect(of(created.generalNotificationChannelId)).toMatchObject({
            explicit: false,
            methods: { email: true, emailWeekly: true, push: false },
        })
        await expect(notificationSubscriptionOperations.read({
            params: { userId, channelIds: [created.generalNotificationChannelId] },
            bypassAuth: true,
        })).resolves.toEqual([of(created.generalNotificationChannelId)])
        await eventNotificationOperations.internal.destroyChannels.internalCall({ params: created })
    })

    test('saving for the channels under one too drops their rows, so they follow it, off included', async () => {
        const [own, info, general] = await readChannelsOfEvent(eventId)
        const resolvedOf = async (channelId: number) => (
            await notificationSubscriptionOperations.read({ params: { userId }, bypassAuth: true })
        ).find(subscription => subscription.channelId === channelId)

        await notificationSubscriptionOperations.update({
            params: { userId, channelId: own.id },
            data: { email: true, emailWeekly: true, push: false, includeChildren: true },
            bypassAuth: true,
        })
        expect(await prisma.notificationSubscription.count({
            where: { userId, channelId: { in: [info.id, general.id] } },
        })).toBe(0)
        expect(await resolvedOf(own.id))
            .toMatchObject({ explicit: true, methods: { email: true, emailWeekly: true, push: false } })
        expect(await resolvedOf(info.id))
            .toMatchObject({ explicit: false, methods: { email: true, emailWeekly: false, push: false } })
        expect(await resolvedOf(general.id))
            .toMatchObject({ explicit: false, methods: { email: true, emailWeekly: true, push: false } })

        // Off is a row too, which the channels under it follow whatever is on above it.
        await notificationSubscriptionOperations.update({
            params: { userId, channelId: own.id },
            data: { email: false, emailWeekly: false, push: false },
            bypassAuth: true,
        })
        expect(await prisma.notificationSubscription.count({ where: { userId, channelId: own.id } })).toBe(1)
        expect(await resolvedOf(general.id))
            .toMatchObject({ explicit: false, methods: { email: false, emailWeekly: false, push: false } })
    })

    test('deleting the event takes its channels with it', async () => {
        const channelIds = (await readChannelsOfEvent(eventId)).map(channel => channel.id)
        await eventOperations.destroy({ params: { id: eventId }, bypassAuth: true })
        expect(await prisma.notificationChannel.count({ where: { id: { in: channelIds } } })).toBe(0)
    })
})
