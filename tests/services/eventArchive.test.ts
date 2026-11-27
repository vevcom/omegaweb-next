import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'

const DAY = 24 * 60 * 60 * 1000
const creator = Session.fromJsObject({ user: null, permissions: ['EVENT_CREATE'], memberships: [] })

let committeeId: number

beforeAll(async () => {
    const committee = await prisma.committee.create({
        data: {
            name: 'Archive committee',
            shortName: 'archive',
            group: { create: { groupType: 'COMMITTEE', order: 1 } },
            committeeArticle: { create: { name: 'archive', coverImage: { create: {} } } },
            paragraph: { create: {} },
        },
    })
    committeeId = committee.id
})

const daysAgo = (days: number) => new Date(Date.now() - days * DAY)

const createPastEvent = async (name: string, eventStart: Date) => {
    const event = await eventOperations.create({
        data: { kind: 'ORDINARY', name, hostedByCommitteeId: committeeId },
        session: creator,
    })
    await prisma.event.update({
        where: { id: event.id },
        data: { eventStart, eventEnd: new Date(eventStart.getTime() + DAY / 12) },
    })
}

const readArchivePage = async (after?: { id: number }) => {
    const page = after ? { page: 1, pageSize: 2, cursor: after } : { page: 0 as const, pageSize: 2, cursor: null }
    const events = await eventOperations.readManyArchivedPage({
        params: {
            paging: { page, details: { name: 'Arkivtest', tags: null } },
        },
        bypassAuth: true,
    })
    return events.map(event => event.name)
}

describe('the event archive', () => {
    test('pages from the newest event to the oldest', async () => {
        const sameStart = daysAgo(30)
        await createPastEvent('Arkivtest eldst', daysAgo(900))
        await createPastEvent('Arkivtest nyest', daysAgo(2))
        await createPastEvent('Arkivtest samme start A', sameStart)
        await createPastEvent('Arkivtest samme start B', sameStart)

        const firstPage = await readArchivePage()
        expect(firstPage).toEqual(['Arkivtest nyest', 'Arkivtest samme start B'])

        const lastOfFirstPage = await prisma.event.findFirstOrThrow({ where: { name: firstPage[1] } })
        const secondPage = await readArchivePage({ id: lastOfFirstPage.id })
        expect(secondPage).toEqual(['Arkivtest samme start A', 'Arkivtest eldst'])
    })
})
