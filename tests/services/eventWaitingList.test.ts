import { recordSentMail } from 'tests/utils'
import { prisma } from '@/prisma/client'
import { eventOperations } from '@/services/events/operations'
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
                canBeViewdBy: 'ALL',
                takesRegistration: true,
                places: 1,
                waitingList: true,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })

        // Created one by one, since the order of the queue is the order of creation.
        await prisma.eventRegistration.create({ data: { eventId: event.id, userId: userIds[0] } })
        await prisma.eventRegistration.create({ data: { eventId: event.id, userId: userIds[1] } })
        await prisma.eventRegistration.create({
            data: { event: { connect: { id: event.id } }, contact: { create: { name: 'Test Guest', email: guestEmail } } },
        })
        await prisma.eventRegistration.create({ data: { eventId: event.id, userId: userIds[2] } })

        notifySpy.mockClear()
        return event
    }

    test('tells the ones promoted, and only them', async () => {
        const event = await createEventWithWaitingList()

        await eventOperations.update({ params: { id: event.id }, data: { places: 3 }, bypassAuth: true })

        expect(notifySpy).toHaveBeenCalledTimes(1)
        expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
            params: { special: 'EVENT_WAITINGLIST_PROMOTION' },
            data: expect.objectContaining({ audience: { userIds: [userIds[1]] } }),
        }))
        expect(sentMail).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({ to: guestEmail }))
    })

    test('still saves the places and tells the others when a guest mail cannot be sent', async () => {
        const event = await createEventWithWaitingList()
        sentMail.mockRejectedValueOnce(new Error('Mail server down'))

        await eventOperations.update({ params: { id: event.id }, data: { places: 3 }, bypassAuth: true })

        await expect(prisma.event.findUniqueOrThrow({ where: { id: event.id } })).resolves.toMatchObject({ places: 3 })
        expect(notifySpy).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledTimes(1)
    })

    test('tells no one when the places do not grow', async () => {
        const event = await createEventWithWaitingList()

        await eventOperations.update({
            params: { id: event.id },
            data: { name: 'Test waiting list renamed' },
            bypassAuth: true,
        })
        await eventOperations.update({ params: { id: event.id }, data: { places: 0 }, bypassAuth: true })

        expect(notifySpy).not.toHaveBeenCalled()
        expect(sentMail).not.toHaveBeenCalled()
    })
})
