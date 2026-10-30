import { recordSentMail } from 'tests/utils'
import { prisma } from '@/prisma/client'
import { eventOperations } from '@/services/events/operations'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { eventRegistrationQueueOrder } from '@/services/events/registration/constants'
import { notificationOperations } from '@/services/notifications/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'

const dayMs = 24 * 60 * 60 * 1000
const guestEmail = 'guest@example.com'

describe('waiting list promotion on more places', () => {
    const userIds: number[] = []
    const notifySpy = jest.spyOn(notificationOperations.createSpecial, 'internalCall')
    let sentMail: ReturnType<typeof recordSentMail>

    beforeAll(async () => {
        const users = await Promise.all(['first', 'second', 'third'].map(name => userOperations.create({
            data: {
                email: `test-waitinglist-${name}@example.com`,
                firstname: 'Test',
                lastname: 'User',
                username: `test-waitinglist-${name}`,
            },
            bypassAuth: true,
        })))
        userIds.push(...users.map(user => user.id))
    })

    beforeEach(() => {
        notifySpy.mockReset()
        notifySpy.mockResolvedValue({ notification: null })
        sentMail = recordSentMail()
    })

    /**
     * An event with one place, taken by the first user, and a waiting list of the second user, a
     * guest and the third user - in that order.
     */
    async function createEventWithWaitingList() {
        const event = await eventOperations.create({
            data: {
                name: 'Test waiting list',
                location: 'Lophtet',
                eventStart: new Date(Date.now() + dayMs),
                eventEnd: new Date(Date.now() + 2 * dayMs),
                canBeViewedBy: 'ALL',
                takesRegistration: true,
                places: 1,
                waitingList: true,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })

        const quota = await prisma.eventRegistrationQuota.findFirstOrThrow({ where: { eventId: event.id } })

        // Created one by one, since the order of the waiting list is the order of creation.
        await prisma.eventRegistration.create({ data: { state: 'IN_QUOTA', quotaId: quota.id, userId: userIds[0] } })
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListEventId: event.id, userId: userIds[1] },
        })
        await prisma.eventRegistration.create({
            data: {
                state: 'WAITING_LIST',
                waitingListEvent: { connect: { id: event.id } },
                contact: { create: { name: 'Test Guest', email: guestEmail } },
            },
        })
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListEventId: event.id, userId: userIds[2] },
        })

        notifySpy.mockClear()
        return { event, quota }
    }

    const setPlaces = (quotaId: number, places: number) => eventQuotaOperations.update({
        params: { id: quotaId }, data: { places }, bypassAuth: true,
    })

    test('tells the ones promoted, and only them', async () => {
        const { quota } = await createEventWithWaitingList()

        await setPlaces(quota.id, 3)

        expect(notifySpy).toHaveBeenCalledTimes(1)
        expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
            params: { special: 'EVENT_WAITINGLIST_PROMOTION' },
            data: expect.objectContaining({ audience: { userIds: [userIds[1]] } }),
        }))
        expect(sentMail).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({ to: guestEmail }))
    })

    test('still saves the places and tells the others when a guest mail cannot be sent', async () => {
        const { quota } = await createEventWithWaitingList()
        sentMail.mockRejectedValueOnce(new Error('Mail server down'))

        await setPlaces(quota.id, 3)

        await expect(prisma.eventRegistrationQuota.findUniqueOrThrow({ where: { id: quota.id } }))
            .resolves.toMatchObject({ places: 3 })
        expect(notifySpy).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledTimes(1)
    })

    test('tells no one when the places do not grow', async () => {
        const { event, quota } = await createEventWithWaitingList()

        await eventOperations.update({
            params: { id: event.id },
            data: { name: 'Test waiting list renamed' },
            bypassAuth: true,
        })
        await setPlaces(quota.id, 0)

        expect(notifySpy).not.toHaveBeenCalled()
        expect(sentMail).not.toHaveBeenCalled()
    })
})

describe('moving registrations in the queue', () => {
    const userIds: number[] = []
    const notifySpy = jest.spyOn(notificationOperations.createSpecial, 'internalCall')

    beforeAll(async () => {
        const users = await Promise.all(['a', 'b', 'c'].map(name => userOperations.create({
            data: {
                email: `test-queuemove-${name}@example.com`,
                firstname: 'Test',
                lastname: 'User',
                username: `test-queuemove-${name}`,
            },
            bypassAuth: true,
        })))
        userIds.push(...users.map(user => user.id))
    })

    beforeEach(() => {
        notifySpy.mockReset()
        notifySpy.mockResolvedValue({ notification: null })
    })

    /**
     * An event with `places` places, taken by the first users, and the rest of them on the waiting
     * list in order, all queued at the same time when `sameTime`.
     */
    async function createEventWithQueue({ sameTime = false, places = 0 } = {}) {
        const event = await eventOperations.create({
            data: {
                name: 'Test queue moving',
                location: 'Lophtet',
                eventStart: new Date(Date.now() + dayMs),
                eventEnd: new Date(Date.now() + 2 * dayMs),
                canBeViewedBy: 'ALL',
                takesRegistration: true,
                places,
                waitingList: true,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        const quota = await prisma.eventRegistrationQuota.findFirstOrThrow({ where: { eventId: event.id } })
        const queuedAt = new Date('2026-01-01T12:00:00Z')
        const registrations = []
        for (let index = 0; index < userIds.length; index++) {
            registrations.push(await prisma.eventRegistration.create({
                data: {
                    ...(index < places
                        ? { state: 'IN_QUOTA', quotaId: quota.id }
                        : { state: 'WAITING_LIST', waitingListEventId: event.id }),
                    userId: userIds[index],
                    queuedAt: sameTime ? queuedAt : new Date(queuedAt.getTime() + index * 1000),
                },
            }))
        }
        return { event, registrations }
    }

    async function queuedUserIds(eventId: number) {
        const registrations = await prisma.eventRegistration.findMany({
            where: { waitingListEventId: eventId },
            orderBy: eventRegistrationQueueOrder,
            select: { userId: true },
        })
        return registrations.map(registration => registration.userId)
    }

    test('a registration with a place is not in the queue, and stays where it is', async () => {
        const { event, registrations } = await createEventWithQueue({ places: 1 })

        await expect(eventRegistrationOperations.move({
            params: { registrationId: registrations[0].id, direction: 'DOWN' },
            bypassAuth: true,
        })).rejects.toThrow()

        expect(await queuedUserIds(event.id)).toEqual([userIds[1], userIds[2]])
        expect(notifySpy).not.toHaveBeenCalled()
    })

    test('moving within the waiting list tells no one', async () => {
        const { event, registrations } = await createEventWithQueue()

        await eventRegistrationOperations.move({
            params: { registrationId: registrations[1].id, direction: 'DOWN' },
            bypassAuth: true,
        })

        expect(await queuedUserIds(event.id)).toEqual([userIds[0], userIds[2], userIds[1]])
        expect(notifySpy).not.toHaveBeenCalled()
    })

    test('moves one step when the queue times are equal', async () => {
        const { event, registrations } = await createEventWithQueue({ sameTime: true })

        await eventRegistrationOperations.move({
            params: { registrationId: registrations[2].id, direction: 'UP' },
            bypassAuth: true,
        })
        expect(await queuedUserIds(event.id)).toEqual([userIds[0], userIds[2], userIds[1]])

        await eventRegistrationOperations.move({
            params: { registrationId: registrations[0].id, direction: 'DOWN' },
            bypassAuth: true,
        })
        expect(await queuedUserIds(event.id)).toEqual([userIds[2], userIds[0], userIds[1]])
    })

    test('cannot move past the ends of the queue', async () => {
        const { registrations } = await createEventWithQueue()

        await expect(eventRegistrationOperations.move({
            params: { registrationId: registrations[0].id, direction: 'UP' },
            bypassAuth: true,
        })).rejects.toThrow()
        await expect(eventRegistrationOperations.move({
            params: { registrationId: registrations[2].id, direction: 'DOWN' },
            bypassAuth: true,
        })).rejects.toThrow()
    })

    test('a registration cannot be marked paid when the event takes no payment', async () => {
        const { registrations } = await createEventWithQueue()

        await expect(eventRegistrationOperations.setManuallyPaid({
            params: { registrationId: registrations[0].id }, data: { manuallyPaid: true }, bypassAuth: true,
        })).rejects.toThrow()
    })

    test('a manually paid registration is marked and unmarked', async () => {
        const { event, registrations } = await createEventWithQueue()
        await prisma.event.update({ where: { id: event.id }, data: { takesPayment: true } })
        const registrationId = registrations[0].id

        await eventRegistrationOperations.setManuallyPaid({
            params: { registrationId }, data: { manuallyPaid: true }, bypassAuth: true,
        })
        await expect(prisma.eventRegistration.findUniqueOrThrow({ where: { id: registrationId } }))
            .resolves.toMatchObject({ manuallyPaid: true })

        await eventRegistrationOperations.setManuallyPaid({
            params: { registrationId }, data: { manuallyPaid: false }, bypassAuth: true,
        })
        await expect(prisma.eventRegistration.findUniqueOrThrow({ where: { id: registrationId } }))
            .resolves.toMatchObject({ manuallyPaid: false })
    })
})
