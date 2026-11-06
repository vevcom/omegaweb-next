import { Session } from '@/auth/session/Session'
import { toVariantDrafts } from '@/components/Event/eventSetupDraft'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import type { Data } from '@/services/serviceOperation'

const HOUR = 60 * 60 * 1000
const period = {
    registrationStart: new Date(Date.now() - HOUR),
    registrationEnd: new Date(Date.now() + 24 * HOUR),
    takesPayment: false,
}
const open = { visibilityRequirements: [] as { conditions: [] }[] }

let groupId: number
let userIds: number[]
let currentOrder: number
const notifySpy = jest.spyOn(eventNotificationOperations.internal.createInfoNotification, 'internalCall')

beforeAll(async () => {
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    groupId = (await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: 'savers', shortName: 'savers' } },
        },
    })).id
    const users = await Promise.all(['first', 'second', 'third'].map(name => userOperations.create({
        data: {
            email: `event-save-${name}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username: `event-save-${name}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    userIds = users.map(user => user.id)
})

async function createEvent(name: string) {
    const event = await eventOperations.create({
        data: {
            name,
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 48 * HOUR),
            eventEnd: new Date(Date.now() + 50 * HOUR),
            takesRegistration: false,
            visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }],
        },
        bypassAuth: true,
    })
    return event.id
}

const save = (id: number, data: Data<typeof eventOperations.update>) => eventOperations.update({
    params: { id },
    data,
    bypassAuth: true,
})

const variantsOf = (eventId: number) => prisma.eventVariant.findMany({
    where: { eventId },
    orderBy: { order: 'asc' },
    include: { quotas: { orderBy: { order: 'asc' } } },
})

async function createEventWithQueue(name: string) {
    const eventId = await createEvent(name)
    await save(eventId, {
        waitingList: true,
        variants: [{ name: 'Påmelding', ...period, quotas: [{ name: 'Alle', places: 1, ...open }] }],
    })
    const [variant] = await variantsOf(eventId)
    const registrations = await Promise.all(userIds.slice(0, 2).map(userId => eventRegistrationOperations.createAsAdmin({
        params: { userId, eventId },
        bypassAuth: true,
    })))
    return { eventId, variant, registrations }
}

describe('saving an event with its registration', () => {
    test('creates variants and quotas in the order given', async () => {
        const eventId = await createEvent('Lager alt')

        await save(eventId, {
            variants: [
                {
                    name: 'Vanlig',
                    ...period,
                    quotas: [{ name: 'Første', places: 5, ...open }, { name: 'Andre', places: 3, ...open }],
                },
                { name: 'VIP', ...period, quotas: [{ name: 'Påmelding', places: 2, ...open }] },
            ],
        })

        const variants = await variantsOf(eventId)
        expect(variants.map(variant => variant.name)).toEqual(['Vanlig', 'VIP'])
        expect(variants[0].quotas.map(quota => quota.name)).toEqual(['Første', 'Andre'])
    })

    test('reorders, renames and removes what the save leaves out', async () => {
        const eventId = await createEvent('Endrer alt')
        await save(eventId, {
            variants: [{
                name: 'Vanlig',
                ...period,
                quotas: [
                    { name: 'Første', places: 5, ...open },
                    { name: 'Andre', places: 3, ...open },
                    { name: 'Tredje', places: 1, ...open },
                ],
            }],
        })
        const [variant] = await variantsOf(eventId)
        const [first, second, third] = variant.quotas

        await save(eventId, {
            variants: [{
                id: variant.id,
                name: 'Nytt navn',
                ...period,
                quotas: [
                    { id: third.id, name: 'Tredje', places: 9, ...open },
                    { id: first.id, name: 'Første', places: 5, ...open },
                ],
            }],
        })

        const [saved] = await variantsOf(eventId)
        expect(saved.name).toBe('Nytt navn')
        expect(saved.quotas.map(quota => [quota.name, quota.places])).toEqual([['Tredje', 9], ['Første', 5]])
        expect(await prisma.visibility.findUnique({ where: { id: second.visibilityId } })).toBeNull()
    })

    test('saves who may register through a quota', async () => {
        const { eventId, variant } = await createEventWithQueue('Bytter hvem')
        const requirements = [{ conditions: [{ type: 'ACTIVE' as const, groupId }] }]

        await save(eventId, {
            variants: [{
                id: variant.id,
                name: 'Påmelding',
                ...period,
                quotas: [{ id: variant.quotas[0].id, name: 'Alle', places: 1, visibilityRequirements: requirements }],
            }],
        })

        const matrix = await eventQuotaOperations.visibility.readMatrix({
            params: { id: variant.quotas[0].id },
            bypassAuth: true,
        })
        expect(matrix.requirements[0].conditions[0]).toMatchObject({ groupId })
    })

    test('promotes from the waiting list when the places grow, and says so', async () => {
        const { eventId, variant, registrations } = await createEventWithQueue('Flere plasser')
        notifySpy.mockClear()

        await save(eventId, {
            variants: [{
                id: variant.id,
                name: 'Påmelding',
                ...period,
                quotas: [{ id: variant.quotas[0].id, name: 'Alle', places: 2, ...open }],
            }],
        })

        const states = await prisma.eventRegistration.findMany({
            where: { id: { in: registrations.map(registration => registration.id) } },
            select: { state: true },
        })
        expect(states.map(registration => registration.state)).toEqual(['IN_QUOTA', 'IN_QUOTA'])
        expect(notifySpy).toHaveBeenCalledTimes(1)
    })

    test('keeps the info of a variant, and drops it when left empty', async () => {
        const id = await createEvent('Pulje med info')
        const variant = { name: 'Pulje 1', ...period, takesPayment: false, quotas: [{ name: 'Alle', places: 5, ...open }] }

        await save(id, { variants: [{ ...variant, description: 'Møt opp kl. 17:00' }] })
        const { variants } = await eventOperations.read({ params: { id }, bypassAuth: true })
        expect(toVariantDrafts(variants)[0].description).toBe('Møt opp kl. 17:00')

        await save(id, { variants: [{ ...variant, id: variants[0].id, description: '  ' }] })
        const after = await eventOperations.read({ params: { id }, bypassAuth: true })
        expect(after.variants[0].description).toBeNull()
    })

    test('keeps moving unpaid registrations back through the form', async () => {
        const id = await createEvent('Flytter ubetalte')
        await save(id, {
            variants: [{
                name: 'Påmelding',
                ...period,
                takesPayment: true,
                price: 100,
                paymentStart: period.registrationStart,
                paymentEnd: period.registrationEnd,
                requeueUnpaidRegistrations: true,
                quotas: [{ name: 'Alle', places: 5, ...open }],
            }],
        })

        const { variants } = await eventOperations.read({ params: { id }, bypassAuth: true })
        expect(toVariantDrafts(variants)[0].requeueUnpaidRegistrations).toBe(true)
    })

    test('leaves out what was not sent', async () => {
        const { eventId } = await createEventWithQueue('Bare navnet')

        await save(eventId, { name: 'Nytt navn på det' })

        expect(await variantsOf(eventId)).toHaveLength(1)
    })
})

describe('a refused save', () => {
    test('saves nothing when a quota with registrants is left out', async () => {
        const { eventId, variant } = await createEventWithQueue('Skal ikke endres')

        await expect(save(eventId, {
            name: 'Dette skal ikke lagres',
            variants: [{ id: variant.id, name: 'Påmelding', ...period, quotas: [] }],
        })).rejects.toThrow(Smorekopp)

        const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
        expect(event.name).toBe('Skal ikke endres')
        expect((await variantsOf(eventId))[0].quotas).toHaveLength(1)
    })

    test('refuses a variant with registrants being left out', async () => {
        const { eventId } = await createEventWithQueue('Variant blir')

        await expect(save(eventId, { variants: [] })).rejects.toThrow(Smorekopp)
        expect(await variantsOf(eventId)).toHaveLength(1)
    })

    test('refuses ids of another event', async () => {
        const { variant } = await createEventWithQueue('Eier varianten')
        const otherId = await createEvent('Annet arrangement')

        await expect(save(otherId, {
            variants: [{ id: variant.id, name: 'Stjålet', ...period, quotas: [] }],
        })).rejects.toThrow(Smorekopp)
    })

    test('refuses invalid variants, and leaves the rest', async () => {
        const eventId = await createEvent('Ugyldig periode')

        await expect(save(eventId, {
            name: 'Dette skal ikke lagres',
            variants: [{
                name: 'Baklengs',
                ...period,
                registrationStart: new Date(Date.now() + HOUR),
                registrationEnd: new Date(Date.now() - HOUR),
                quotas: [],
            }],
        })).rejects.toThrow(Smorekopp)

        expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).name).toBe('Ugyldig periode')
    })
})

describe('who administrates, and the account', () => {
    test('replaces who administrates the event', async () => {
        const eventId = await createEvent('Nye admins')
        const other = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order: currentOrder,
                manualGroup: { create: { name: 'other savers', shortName: 'osavers' } },
            },
        })

        await save(eventId, { adminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: other.id }] }] })

        const matrix = await eventOperations.adminVisibility.readMatrix({ params: { id: eventId }, bypassAuth: true })
        expect(matrix.requirements[0].conditions[0]).toMatchObject({ groupId: other.id })
    })

    test('takes access to the account to link it, on top of administrating the event', async () => {
        const eventId = await createEvent('Konto kreves')
        const owner = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order: currentOrder,
                manualGroup: { create: { name: 'account owners', shortName: 'aowners' } },
            },
        })
        const account = await ledgerAccountOperations.create({
            data: { name: 'somebody elses', groupIds: [owner.id] },
            bypassAuth: true,
        })
        const administrator = Session.fromJsObject({
            user: null,
            permissions: [],
            memberships: [{ groupId, order: currentOrder, active: true, admin: false }],
        })

        await expect(eventOperations.update({
            params: { id: eventId },
            data: { ledgerAccountSelection: account.id },
            session: administrator,
        })).rejects.toThrow(Smorekopp)

        await expect(save(eventId, { ledgerAccountSelection: account.id }))
            .resolves.toMatchObject({ ledgerAccountId: account.id })
    })

    test('an account left unpicked leaves the link as it is', async () => {
        const eventId = await createEvent('Konto står')
        const formData = new FormData()
        formData.append('ledgerAccountSelection', 'NULL')

        await expect(eventOperations.update({ params: { id: eventId }, data: formData, bypassAuth: true }))
            .resolves.toMatchObject({ ledgerAccountId: null })
    })
})
