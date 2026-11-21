import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventSeatingOperations } from '@/services/events/seating/operations'
import { notifyPromotedFromWaitingList } from '@/services/events/registration/notifyPromotedFromWaitingList'
import { userOperations } from '@/services/users/operations'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import type { EventKind } from '@/prisma-generated-pn-types'

const HOUR = 60 * 60 * 1000

const infoSpy = jest.spyOn(eventNotificationOperations.internal.createInfoNotification, 'internalCall')

afterEach(() => {
    infoSpy.mockClear()
})

describe.each([
    ['ORDINARY', '/events/'],
    ['COMPANY_PRESENTATION', '/career/company-presentations/'],
    ['SPEED_INTERVIEW', '/career/speed-interviews/'],
] as const)('a notice about a %s event', (kind: EventKind, pages: string) => {
    let event: { id: number, kind: EventKind, name: string, infoNotificationChannelId: number }
    let userId: number

    const sentUrl = () => {
        expect(infoSpy).toHaveBeenCalledTimes(1)
        return infoSpy.mock.calls[0][0].data?.url
    }

    beforeAll(async () => {
        event = await eventOperations.create({
            data: {
                kind,
                name: `Varsellenke ${kind}`,
                location: 'Lophtet',
                eventStart: new Date(Date.now() + 24 * HOUR),
                eventEnd: new Date(Date.now() + 26 * HOUR),
                canBeViewedBy: 'ALL',
                takesRegistration: true,
                places: 5,
                takesPayment: true,
                price: 100,
                paymentStart: new Date(),
                paymentEnd: new Date(Date.now() + HOUR),
                waitingList: false,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        const user = await userOperations.create({
            data: {
                email: `varsellenke-${kind.toLowerCase()}@omega.ntnu.no`,
                firstname: 'Varsel',
                lastname: 'Lenkesen',
                username: `varsellenke-${kind.toLowerCase()}`,
                emailVerified: new Date().toISOString(),
            },
            bypassAuth: true,
        })
        userId = user.id
        const quota = await prisma.eventQuota.findFirstOrThrow({ where: { variant: { eventId: event.id } } })
        await prisma.eventRegistration.create({ data: { state: 'IN_QUOTA', quotaId: quota.id, userId } })
    })

    test('of a change links to the pages of its kind', async () => {
        await eventOperations.update({ params: { id: event.id }, data: { notifyAboutChange: true }, bypassAuth: true })
        expect(sentUrl()).toMatch(new RegExp(`^${pages}varsellenke-`))
    })

    test('reminding of payment links to the pages of its kind', async () => {
        await eventNotificationOperations.createPaymentReminder({ params: { eventId: event.id }, bypassAuth: true })
        expect(sentUrl()).toMatch(new RegExp(`^${pages}varsellenke-`))
    })

    test('of a promotion from the waiting list links to the pages of its kind', async () => {
        await notifyPromotedFromWaitingList(event, [{ userId, contact: null }])
        expect(sentUrl()).toMatch(new RegExp(`^${pages}varsellenke-`))
    })

    test('of the seating links to the pages of its kind', async () => {
        await eventSeatingOperations.openWishes({
            params: { id: event.id },
            data: { wishesEnd: new Date(Date.now() + 12 * HOUR) },
            bypassAuth: true,
        })
        expect(sentUrl()).toMatch(new RegExp(`^${pages}varsellenke-`))
    })
})
