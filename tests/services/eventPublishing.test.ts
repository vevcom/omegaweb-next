import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventVariantOperations } from '@/services/events/variants/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const creator = Session.fromJsObject({ user: null, permissions: ['EVENT_CREATE'], memberships: [] })

let committeeId: number
let groupId: number

beforeAll(async () => {
    const committee = await prisma.committee.create({
        data: {
            name: 'Publishing committee',
            shortName: 'publishing',
            group: { create: { groupType: 'COMMITTEE', order: 1 } },
            committeeArticle: { create: { name: 'publishing', coverImage: { create: {} } } },
            paragraph: { create: {} },
        },
    })
    committeeId = committee.id
    groupId = committee.groupId
})

const createDraft = (name: string) => eventOperations.create({
    data: { name, hostedByCommitteeId: committeeId },
    session: creator,
})

const setPublished = (id: number, published = true) => eventOperations.setPublished({
    params: { id },
    data: { published },
    bypassAuth: true,
})

const fillIn = (id: number) => eventOperations.update({
    params: { id },
    data: {
        location: 'Lophtet',
        eventStart: new Date(Date.now() + 24 * HOUR),
        eventEnd: new Date(Date.now() + 26 * HOUR),
    },
    bypassAuth: true,
})

describe('creating an event from a name', () => {
    test('makes a draft the host committee administrates', async () => {
        const event = await createDraft('Bare et navn')

        const stored = await prisma.event.findUniqueOrThrow({
            where: { id: event.id },
            include: {
                visibilityAdmin: { include: { requirements: { include: { conditions: true } } } },
                variants: true,
            },
        })
        expect(stored).toMatchObject({ published: false, location: null, canBeViewedBy: 'ALL', variants: [] })
        expect(stored.visibilityAdmin.requirements.map(requirement => requirement.conditions.map(condition => (
            condition.groupId
        )))).toEqual([[groupId]])
    })

    test('works from what the form sends', async () => {
        const formData = new FormData()
        formData.append('name', 'Fra skjemaet')
        formData.append('hostedByCommitteeId', String(committeeId))

        await expect(eventOperations.create({ data: formData, session: creator }))
            .resolves.toMatchObject({ name: 'Fra skjemaet', hostedByCommitteeId: committeeId, waitingList: false })
    })

    test('stays on the list of current events', async () => {
        const event = await createDraft('Utkast i listen')

        expect(event.eventEnd.getTime()).toBeGreaterThan(Date.now())
    })

    test('is refused with no one to administrate it', async () => {
        await expect(eventOperations.create({ data: { name: 'Ingen admin' }, session: creator }))
            .rejects.toThrow(Smorekopp)
    })
})

describe('publishing', () => {
    test('is refused until the time and place are set', async () => {
        const event = await createDraft('Mangler ting')

        await expect(setPublished(event.id)).rejects.toThrow('BAD PARAMETERS')

        await fillIn(event.id)
        await expect(setPublished(event.id)).resolves.toMatchObject({ published: true })
    })

    test('is refused for a paid event without an account', async () => {
        const event = await createDraft('Betalt uten konto')
        await fillIn(event.id)
        await eventVariantOperations.create({
            params: { eventId: event.id },
            data: {
                name: 'Betalt',
                registrationStart: new Date(Date.now() - HOUR),
                registrationEnd: new Date(Date.now() + HOUR),
                takesPayment: true,
                price: 50,
                paymentStart: new Date(Date.now() - HOUR),
                paymentEnd: new Date(Date.now() + HOUR),
            },
            bypassAuth: true,
        })

        await expect(setPublished(event.id)).rejects.toThrow('BAD PARAMETERS')

        const account = await ledgerAccountOperations.create({
            data: { name: 'publishing', groupIds: [groupId] },
            bypassAuth: true,
        })
        await prisma.event.update({ where: { id: event.id }, data: { ledgerAccountId: account.id } })
        await expect(setPublished(event.id)).resolves.toMatchObject({ published: true })
    })

    test('an emptied place counts as unset', async () => {
        const event = await createDraft('Sted fjernes')
        await fillIn(event.id)
        const formData = new FormData()
        formData.append('location', '')

        await eventOperations.update({ params: { id: event.id }, data: formData, bypassAuth: true })

        await expect(setPublished(event.id)).rejects.toThrow('BAD PARAMETERS')
    })

    test('can always be taken back', async () => {
        const event = await createDraft('Avpubliseres')
        await fillIn(event.id)
        await setPublished(event.id)
        await prisma.event.update({ where: { id: event.id }, data: { location: null } })

        await expect(setPublished(event.id, false)).resolves.toMatchObject({ published: false })
    })
})
