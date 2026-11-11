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

const save = (id: number, data: Data<typeof eventOperations.saveSetup>) => eventOperations.saveSetup({
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

    test('judges who sees the event by the quotas the same save leaves it with', async () => {
        const eventId = await createEvent('Sees gjennom kvoter')
        await eventOperations.setPublished({ params: { id: eventId }, data: { published: true }, bypassAuth: true })
        const throughQuotas = { canBeViewedBy: 'CAN_REGISTER' as const }

        await expect(save(eventId, throughQuotas)).rejects.toThrow(Smorekopp)
        await save(eventId, {
            ...throughQuotas,
            variants: [{ name: 'Påmelding', ...period, quotas: [{ name: 'Alle', places: 0, ...open }] }],
        })
        expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject(throughQuotas)

        await save(eventId, { canBeViewedBy: 'ALL', variants: [] })
        expect(await variantsOf(eventId)).toHaveLength(0)
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

describe('a save based on the event as it was', () => {
    const updatedAtOf = async (id: number) => (await prisma.event.findUniqueOrThrow({ where: { id } })).updatedAt

    test('is refused once the event has been saved since, and saves nothing', async () => {
        const { eventId, variant } = await createEventWithQueue('Lest for lenge siden')
        const basedOnUpdatedAt = await updatedAtOf(eventId)

        await save(eventId, { name: 'Lagret av en annen', basedOnUpdatedAt })
        await expect(save(eventId, {
            name: 'Lagret for sent',
            variants: [{ id: variant.id, name: 'Påmelding', ...period, quotas: [] }],
            basedOnUpdatedAt,
        })).rejects.toThrow(Smorekopp)

        expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).name).toBe('Lagret av en annen')
        expect((await variantsOf(eventId))[0].quotas).toHaveLength(1)
        await expect(save(eventId, { name: 'Lagret i tide', basedOnUpdatedAt: await updatedAtOf(eventId) }))
            .resolves.toMatchObject({ name: 'Lagret i tide' })
    })

    test('is told apart by every save, whatever it changes, and not by someone registering', async () => {
        const { eventId, variant } = await createEventWithQueue('Hva flytter tiden')
        const quota = variant.quotas[0]
        const before = await updatedAtOf(eventId)

        await save(eventId, {
            variants: [{
                id: variant.id,
                name: 'Påmelding',
                ...period,
                quotas: [{ id: quota.id, name: 'Alle', places: 2, ...open }],
            }],
        })
        const afterVariants = await updatedAtOf(eventId)
        expect(afterVariants.getTime()).toBeGreaterThan(before.getTime())

        await save(eventId, { adminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }] })
        const afterAdministrators = await updatedAtOf(eventId)
        expect(afterAdministrators.getTime()).toBeGreaterThan(afterVariants.getTime())

        await eventRegistrationOperations.createAsAdmin({ params: { userId: userIds[2], eventId }, bypassAuth: true })
        expect(await updatedAtOf(eventId)).toEqual(afterAdministrators)
    })

    test('is read from the form as the date it posts', async () => {
        const eventId = await createEvent('Fra skjemaet')
        const formData = new FormData()
        formData.append('name', 'Navn fra skjemaet')
        formData.append('basedOnUpdatedAt', (await updatedAtOf(eventId)).toISOString())

        await expect(eventOperations.saveSetup({ params: { id: eventId }, data: formData, bypassAuth: true }))
            .resolves.toMatchObject({ name: 'Navn fra skjemaet' })
        await expect(eventOperations.saveSetup({ params: { id: eventId }, data: formData, bypassAuth: true }))
            .rejects.toThrow(Smorekopp)
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

    test('saves the rest too when the one saving hands the event to others', async () => {
        const eventId = await createEvent('Gis bort')
        const other = await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order: currentOrder,
                manualGroup: { create: { name: 'heirs', shortName: 'heirs' } },
            },
        })
        const administrator = Session.fromJsObject({
            user: null,
            permissions: [],
            memberships: [{ groupId, order: currentOrder, active: true, admin: false }],
        })

        await eventOperations.saveSetup({
            params: { id: eventId },
            data: { name: 'Gitt videre', adminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: other.id }] }] },
            session: administrator,
        })

        expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).name).toBe('Gitt videre')
        await expect(eventOperations.saveSetup({
            params: { id: eventId }, data: { name: 'For sent' }, session: administrator,
        })).rejects.toThrow(Smorekopp)
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

        await expect(eventOperations.saveSetup({
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

        await expect(eventOperations.saveSetup({ params: { id: eventId }, data: formData, bypassAuth: true }))
            .resolves.toMatchObject({ ledgerAccountId: null })
    })
})
