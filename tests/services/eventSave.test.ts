import { testSession } from 'tests/utils'
import { toVariantDrafts, variantsToPost } from '@/services/events/setupDraft'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { userOperations } from '@/services/users/operations'
import { companyOperations } from '@/services/careers/companies/operations'
import { EventKind } from '@/prisma-generated-pn-types'
import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import { File } from 'node:buffer'
import type { Data } from '@/services/serviceOperation'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

const HOUR = 60 * 60 * 1000
const period = {
    registrationStart: new Date(Date.now() - HOUR),
    registrationEnd: new Date(Date.now() + 24 * HOUR),
    takesPayment: false,
}
const open = { visibilityRequirements: [] as { conditions: [] }[] }
const svgLogo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')

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

    test('refuses a price emptied in the form for a variant that takes payment, and keeps the price', async () => {
        const id = await createEvent('Tømt pris')
        const paid = {
            name: 'Påmelding',
            ...period,
            takesPayment: true,
            price: 100,
            paymentStart: period.registrationStart,
            paymentEnd: period.registrationEnd,
            quotas: [{ name: 'Alle', places: 5, ...open }],
        }
        await save(id, { variants: [paid] })
        const { variants } = await eventOperations.read({ params: { id }, bypassAuth: true })
        const [draft] = toVariantDrafts(variants)

        // As the form posts a variant whose price field was emptied.
        const emptied = variantsToPost([{ ...draft, price: undefined }])
        expect(emptied[0].price).toBe(0)
        await expect(save(id, { variants: emptied })).rejects.toThrow(Smorekopp)
        expect((await variantsOf(id))[0].price).toBe(10000)

        // A variant that takes no payment has no price to post.
        expect(variantsToPost([{ ...draft, takesPayment: false, price: undefined }])[0].price).toBeUndefined()
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

describe('a save of what is already saved', () => {
    test('writes only what changed', async () => {
        const { eventId, variant } = await createEventWithQueue('Lagres igjen')
        const quotaId = variant.quotas[0].id
        const requirements = [{ conditions: [{ type: 'ACTIVE' as const, groupId }] }]
        const setupWith = (places: number, visibilityRequirements = requirements) => ({
            adminRequirements: requirements,
            variants: [{
                id: variant.id,
                name: 'Påmelding',
                ...period,
                quotas: [{ id: quotaId, name: 'Alle', places, visibilityRequirements }],
            }],
        })
        const stored = async () => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: eventId },
                select: { visibilityAdmin: { select: { requirements: { select: { id: true } } } } },
            })
            const quota = await prisma.eventQuota.findUniqueOrThrow({
                where: { id: quotaId },
                select: { updatedAt: true, visibility: { select: { requirements: { select: { id: true } } } } },
            })
            const { updatedAt } = await prisma.eventVariant.findUniqueOrThrow({ where: { id: variant.id } })
            return {
                variant: updatedAt,
                quota: quota.updatedAt,
                whoRegisters: quota.visibility.requirements,
                whoAdministrates: event.visibilityAdmin.requirements,
            }
        }
        await save(eventId, setupWith(1))
        const first = await stored()

        await save(eventId, { name: 'Lagret igjen', ...setupWith(1) })
        expect(await stored()).toEqual(first)

        await save(eventId, setupWith(2))
        const morePlaces = await stored()
        expect(morePlaces.quota.getTime()).toBeGreaterThan(first.quota.getTime())
        expect({ ...morePlaces, quota: first.quota }).toEqual(first)

        await save(eventId, setupWith(2, []))
        expect(await stored()).toEqual({ ...morePlaces, whoRegisters: [] })
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
        const administrator = testSession({
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
        const administrator = testSession({
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

describe('the kind of an event', () => {
    const kindOf = async (id: number) => (await prisma.event.findUniqueOrThrow({ where: { id } })).kind

    test('is ordinary unless the event is created as another', async () => {
        expect(await kindOf(await createEvent('Et vanlig arrangement'))).toBe('ORDINARY')

        const presentation = await eventOperations.create({
            data: {
                name: 'En bedriftspresentasjon',
                kind: 'COMPANY_PRESENTATION',
                visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }],
            },
            bypassAuth: true,
        })
        expect(presentation.kind).toBe('COMPANY_PRESENTATION')
    })

    test('is not changed by a save', async () => {
        const id = await createEvent('Blir det det var')
        await save(id, { name: 'Blir det det var, med nytt navn', kind: 'COMPANY_PRESENTATION' } as never)

        const event = await prisma.event.findUniqueOrThrow({ where: { id } })
        expect(event.name).toBe('Blir det det var, med nytt navn')
        expect(event.kind).toBe('ORDINARY')
    })
})

describe('the company of an event', () => {
    const companyNameOf = async (id: number) => (
        await eventOperations.read({ params: { id }, bypassAuth: true })
    ).company?.name ?? null
    const createCompany = (name: string) => prisma.company.create({ data: { name, description: '' } })

    test.each(Object.values(EventKind))('of the kind %s is kept through a save, and lost when cleared', async kind => {
        const company = await createCompany(`Selskap for ${kind}`)
        const { id } = await eventOperations.create({
            data: {
                kind,
                name: `Med selskap, ${kind}`,
                companyId: company.id,
                visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }],
            },
            bypassAuth: true,
        })
        expect(await companyNameOf(id)).toBe(company.name)

        await save(id, { name: `Med selskap, ${kind}, omdøpt` })
        expect(await companyNameOf(id)).toBe(company.name)

        const cleared = new FormData()
        cleared.append('companyId', 'NULL')
        await eventOperations.saveSetup({ params: { id }, data: cleared, bypassAuth: true })
        expect(await companyNameOf(id)).toBeNull()
    })

    test('is set and changed by a save', async () => {
        const [first, second] = await Promise.all([createCompany('Første selskap'), createCompany('Andre selskap')])
        const id = await createEvent('Selskapet byttes')

        await save(id, { companyId: first.id })
        expect(await companyNameOf(id)).toBe(first.name)
        await save(id, { companyId: second.id })
        expect(await companyNameOf(id)).toBe(second.name)
    })

    test('is gone from its events when the company is deleted, and the events stay', async () => {
        const company = await createCompany('Selskap som legges ned')
        const id = await createEvent('Overlever selskapet')
        await save(id, { companyId: company.id })

        await companyOperations.destroy({ params: { id: company.id }, bypassAuth: true })

        expect(await companyNameOf(id)).toBeNull()
    })

    test('that does not exist is refused, and the event keeps none', async () => {
        const gone = await createCompany('Selskap som aldri var')
        await prisma.company.delete({ where: { id: gone.id } })
        const id = await createEvent('Selskapet finnes ikke')

        await expect(save(id, { companyId: gone.id })).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
        expect(await companyNameOf(id)).toBeNull()
    })

    test('is on the lists of coming and past events', async () => {
        const company = await createCompany('Selskap på listene')
        const createAt = (name: string, eventStart: Date) => eventOperations.create({
            data: {
                name,
                eventStart,
                eventEnd: new Date(eventStart.getTime() + 2 * HOUR),
                companyId: company.id,
                visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }],
            },
            bypassAuth: true,
        })
        const coming = await createAt('På listen, kommende', new Date(Date.now() + 48 * HOUR))
        const past = await createAt('På listen, forbi', new Date(Date.now() - 48 * HOUR))
        const shown = { id: company.id, name: company.name, logoImage: null }

        const current = await eventOperations.readManyCurrent({
            params: { tags: null, name: 'På listen' },
            bypassAuth: true,
        })
        const archived = await eventOperations.readManyArchivedPage({
            params: {
                paging: { page: { page: 0, pageSize: 50, cursor: null }, details: { name: 'På listen', tags: null } },
            },
            bypassAuth: true,
        })
        expect(current.find(event => event.id === coming.id)?.company).toEqual(shown)
        expect(archived.find(event => event.id === past.id)?.company).toEqual(shown)
    })

    test('is shown to a visitor by its name and logo, and nothing else of it', async () => {
        const company = await prisma.company.create({
            data: {
                name: 'Selskap for alle',
                description: 'Bare for COMPANY_USE',
                website: 'https://selskap.no',
                sponsorTier: 'MAIN',
            },
        })
        const logo = await companyOperations.updateLogo({
            params: { id: company.id },
            data: { imageFile: new File([svgLogo], 'logo.svg', { type: 'image/svg+xml' }) },
            bypassAuth: true,
        })
        const id = await createEvent('Åpent med selskap')
        await save(id, { companyId: company.id })
        await eventOperations.setPublished({ params: { id }, data: { published: true }, bypassAuth: true })

        const event = await eventOperations.read({ params: { id }, session: testSession({}) })

        expect(event.company).toEqual({
            id: company.id,
            name: company.name,
            logoImage: expect.objectContaining({ id: logo.id }),
        })
    })

    describe('is put on an event only with COMPANY_USE, while keeping or clearing it takes no more', () => {
        let user: UserFiltered
        beforeAll(async () => {
            user = await userOperations.create({
                data: {
                    email: 'event-save-company@omega.ntnu.no',
                    firstname: 'Test',
                    lastname: 'Testesen',
                    username: 'event-save-company',
                    emailVerified: new Date().toISOString(),
                },
                bypassAuth: true,
            })
        })
        const sessionWith = (permissions: Permission[]) => testSession({
            user,
            permissions,
            memberships: [{ groupId, order: currentOrder, active: true, admin: false }],
        })
        const createStoredAndOther = async (eventName: string) => {
            const [stored, other] = await Promise.all([
                createCompany(`${eventName}, den som står`),
                createCompany(`${eventName}, den som kommer`),
            ])
            const id = await createEvent(eventName)
            await save(id, { companyId: stored.id })
            return { id, stored, other }
        }

        test.each([
            ['saveSetup', eventOperations.saveSetup],
            ['update', eventOperations.update],
        ] as const)('through %s', async (name, operation) => {
            const { id, stored, other } = await createStoredAndOther(`Selskap gjennom ${name}`)
            const writeAs = (permissions: Permission[], companyId: number | 'NULL') => operation({
                params: { id },
                data: { companyId },
                session: sessionWith(permissions),
            })

            await expect(writeAs([], other.id)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
            expect(await companyNameOf(id)).toBe(stored.name)

            await writeAs([], stored.id)
            expect(await companyNameOf(id)).toBe(stored.name)

            await writeAs([], 'NULL')
            expect(await companyNameOf(id)).toBeNull()

            await writeAs(['COMPANY_USE'], other.id)
            expect(await companyNameOf(id)).toBe(other.name)
        })

        test('through create', async () => {
            const company = await createCompany('Selskap fra start')
            const createAs = (
                permissions: Permission[],
                name: string,
                companyId?: number | 'NULL',
            ) => eventOperations.create({
                data: {
                    name,
                    companyId,
                    visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }],
                },
                session: sessionWith(['EVENT_CREATE', ...permissions]),
            })

            await expect(createAs([], 'Uten rett, med selskap', company.id))
                .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })

            const { id: withoutCompany } = await createAs([], 'Uten rett, uten selskap')
            const { id: clearedCompany } = await createAs([], 'Uten rett, selskap NULL', 'NULL')
            const { id: withCompany } = await createAs(['COMPANY_USE'], 'Med rett, med selskap', company.id)
            expect(await companyNameOf(withoutCompany)).toBeNull()
            expect(await companyNameOf(clearedCompany)).toBeNull()
            expect(await companyNameOf(withCompany)).toBe(company.name)
        })

        test('keeps the stored company as the form posts it, as a string', async () => {
            const { id, stored } = await createStoredAndOther('Selskap fra skjemaet')
            const formData = new FormData()
            formData.append('companyId', String(stored.id))

            await eventOperations.saveSetup({ params: { id }, data: formData, session: sessionWith([]) })

            expect(await companyNameOf(id)).toBe(stored.name)
        })
    })
})
