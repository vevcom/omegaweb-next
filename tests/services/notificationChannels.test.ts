import { prisma } from '@/prisma-pn-client-instance'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'
import { specialNotificationChannelOperations } from '@/services/notifications/channels/special/operations'
import { contactorNotificationChannel } from '@/services/careers/contactorNotificationChannel'
import { eventNotificationChannel } from '@/services/events/eventNotificationChannel'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
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

    test('deleting the event takes its channels with it', async () => {
        const channelIds = (await readChannelsOfEvent(eventId)).map(channel => channel.id)
        await eventOperations.destroy({ params: { id: eventId }, bypassAuth: true })
        expect(await prisma.notificationChannel.count({ where: { id: { in: channelIds } } })).toBe(0)
    })
})
