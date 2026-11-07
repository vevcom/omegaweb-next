import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventVariantOperations } from '@/services/events/variants/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { userOperations } from '@/services/users/operations'
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

    test('is refused with no user or host to administrate it', async () => {
        await expect(eventOperations.create({ data: { name: 'Ingen admin' }, session: creator }))
            .rejects.toThrow(Smorekopp)
    })
})

describe('a draft with no host', () => {
    async function createByUser(username: string) {
        const user = await userOperations.create({
            data: {
                email: `${username}@omega.ntnu.no`,
                firstname: 'Test',
                lastname: 'Testesen',
                username,
                emailVerified: new Date().toISOString(),
            },
            bypassAuth: true,
        })
        const session = Session.fromJsObject({ user, permissions: ['EVENT_CREATE'], memberships: [] })
        const event = await eventOperations.create({ data: { name: 'Uten vert' }, session })
        return { event, session }
    }

    test('is its creator\'s alone', async () => {
        const { event, session } = await createByUser('draftcreator')
        const { session: other } = await createByUser('draftother')

        await expect(eventOperations.update({ params: { id: event.id }, data: { name: 'Nytt navn' }, session }))
            .resolves.toMatchObject({ name: 'Nytt navn' })
        await expect(eventOperations.update({ params: { id: event.id }, data: { name: 'Ikke mitt' }, session: other }))
            .rejects.toThrow(Smorekopp)
        await expect(eventOperations.read({ params: { id: event.id }, session: other })).rejects.toThrow(Smorekopp)
    })

    test('stays on its creator\'s list of events', async () => {
        const { event, session } = await createByUser('draftlister')

        const listed = await eventOperations.readManyCurrent({ params: { tags: null }, session })

        expect(listed.map(current => current.id)).toContain(event.id)
    })

    test('cannot be published until someone administrates it', async () => {
        const { event } = await createByUser('draftnoadmin')
        await fillIn(event.id)

        await expect(setPublished(event.id)).rejects.toThrow('BAD PARAMETERS')
    })

    test('is taken over by a host chosen later, and then left to them once published', async () => {
        const { event, session } = await createByUser('draftadopted')
        await fillIn(event.id)

        await eventOperations.update({ params: { id: event.id }, data: { hostedByCommitteeId: committeeId }, session })
        await expect(setPublished(event.id)).resolves.toMatchObject({ published: true })

        await expect(eventOperations.update({ params: { id: event.id }, data: { name: 'For sent' }, session }))
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
