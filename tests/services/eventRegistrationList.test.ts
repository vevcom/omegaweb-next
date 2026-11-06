import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { REGISTRATION_READER_TYPE } from '@/services/events/registration/constants'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const { REGISTRATIONS, WAITING_LIST } = REGISTRATION_READER_TYPE

async function setUp(key: string) {
    const order = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    const group = await prisma.group.create({
        data: { groupType: 'MANUAL_GROUP', order, manualGroup: { create: { name: key, shortName: key } } },
    })
    const event = await eventOperations.create({
        data: {
            name: 'Badstue',
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 48 * HOUR),
            eventEnd: new Date(Date.now() + 50 * HOUR),
            takesRegistration: false,
            visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: group.id }] }],
        },
        bypassAuth: true,
    })
    const pool = (name: string) => ({
        name,
        registrationStart: new Date(Date.now() - HOUR),
        registrationEnd: new Date(Date.now() + 24 * HOUR),
        takesPayment: false,
        quotas: [{ name: 'Alle', places: 5, visibilityRequirements: [] }],
    })
    await eventOperations.update({
        params: { id: event.id },
        data: { variants: [pool('Pulje 1'), pool('Pulje 2')] },
        bypassAuth: true,
    })
    const [first, second] = await prisma.eventVariant.findMany({
        where: { eventId: event.id },
        orderBy: { order: 'asc' },
        select: { id: true, quotas: { select: { id: true } } },
    })
    const user = (firstname: string, lastname: string) => userOperations.create({
        data: {
            email: `${key}-${firstname}@omega.ntnu.no`,
            firstname,
            lastname,
            username: `${key}-${firstname}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
    const [kari, ola, per] = await Promise.all([user('Kari', 'Nordmann'), user('Ola', 'Nordmann'), user('Per', 'Hansen')])
    await prisma.eventRegistration.createMany({
        data: [
            { state: 'IN_QUOTA', quotaId: first.quotas[0].id, userId: kari.id },
            { state: 'IN_QUOTA', quotaId: second.quotas[0].id, userId: ola.id },
            { state: 'WAITING_LIST', waitingListVariantId: second.id, userId: per.id },
        ],
    })
    const contact = await prisma.contactDetails.create({ data: { name: 'Gjest Gjestesen' } })
    await prisma.eventRegistration.create({
        data: { state: 'IN_QUOTA', quotaId: first.quotas[0].id, contactId: contact.id },
    })

    const names = async (details: { type: REGISTRATION_READER_TYPE, variantId?: number, search?: string }) => {
        const rows = await eventRegistrationOperations.readPage({
            params: {
                paging: { page: { page: 0, pageSize: 50, cursor: null }, details: { eventId: event.id, ...details } },
            },
            bypassAuth: true,
        })
        return rows.map(row => row.user?.firstname ?? row.contact?.name).sort()
    }
    return { names, first, second }
}

describe('the list of registrations', () => {
    test('without a filter holds the whole segment', async () => {
        const { names } = await setUp('list-all')
        expect(await names({ type: REGISTRATIONS })).toEqual(['Gjest Gjestesen', 'Kari', 'Ola'])
        expect(await names({ type: WAITING_LIST })).toEqual(['Per'])
    })

    test('splits by variant, also on the waiting list', async () => {
        const { names, first, second } = await setUp('list-variant')
        expect(await names({ type: REGISTRATIONS, variantId: first.id })).toEqual(['Gjest Gjestesen', 'Kari'])
        expect(await names({ type: REGISTRATIONS, variantId: second.id })).toEqual(['Ola'])
        expect(await names({ type: WAITING_LIST, variantId: first.id })).toEqual([])
        expect(await names({ type: WAITING_LIST, variantId: second.id })).toEqual(['Per'])
    })

    test('searches first and last names, whatever the case', async () => {
        const { names } = await setUp('list-search')
        expect(await names({ type: REGISTRATIONS, search: 'nord' })).toEqual(['Kari', 'Ola'])
        expect(await names({ type: REGISTRATIONS, search: 'KARI' })).toEqual(['Kari'])
    })

    test('needs every word to match', async () => {
        const { names } = await setUp('list-words')
        expect(await names({ type: REGISTRATIONS, search: 'ola nord' })).toEqual(['Ola'])
        expect(await names({ type: REGISTRATIONS, search: 'ola hansen' })).toEqual([])
    })

    test('finds guests without a user', async () => {
        const { names } = await setUp('list-guest')
        expect(await names({ type: REGISTRATIONS, search: 'gjest' })).toEqual(['Gjest Gjestesen'])
    })

    test('searches within a variant and a segment', async () => {
        const { names, second } = await setUp('list-both')
        expect(await names({ type: REGISTRATIONS, variantId: second.id, search: 'kari' })).toEqual([])
        expect(await names({ type: WAITING_LIST, search: 'kari' })).toEqual([])
    })

    test('treats an empty search as no search', async () => {
        const { names } = await setUp('list-empty')
        expect(await names({ type: REGISTRATIONS, search: '   ' })).toHaveLength(3)
    })
})
