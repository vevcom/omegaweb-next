import { createAdministrators } from 'tests/eventSetup'
import { testSession } from 'tests/utils'
import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { withServiceContext } from '@/services/serviceOperation'
import { readCompanyEvents } from '@/app/(careers)/career/companies/[nameAndId]/readCompanyEvents'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { EventCanView, EventKind } from '@/prisma-generated-pn-types'
import type { VisibilityRequirement } from '@/services/visibility/types'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

let visibilityAdminRequirements: VisibilityRequirement[]
let memberRequirements: VisibilityRequirement[]
let currentOrder: number

beforeAll(async () => {
    visibilityAdminRequirements = await createAdministrators('company-event-admins')
    memberRequirements = await createAdministrators('company-event-members')
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
})

const createCompany = (name: string) => prisma.company.create({ data: { name, description: '' } })

async function createEvent(name: string, companyId: number, {
    kind = 'COMPANY_PRESENTATION',
    startsIn = 7 * DAY,
    startsAt,
    published = true,
    canBeViewedBy = 'ALL',
}: { kind?: EventKind, startsIn?: number, startsAt?: Date, published?: boolean, canBeViewedBy?: EventCanView } = {}) {
    const eventStart = startsAt ?? new Date(Date.now() + startsIn)
    const event = await eventOperations.create({
        data: {
            kind,
            name,
            location: 'Lophtet',
            eventStart,
            eventEnd: new Date(eventStart.getTime() + 2 * HOUR),
            canBeViewedBy,
            companyId,
            visibilityAdminRequirements,
            ...(canBeViewedBy === 'CAN_REGISTER' && {
                takesRegistration: true,
                places: 10,
                quotaVisibilityRequirements: memberRequirements,
            }),
        },
        bypassAuth: true,
    })
    if (published) {
        await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    }
    return event
}

const comingNames = async (companyId: number, session: SessionMaybeUser) => (
    await eventOperations.readManyCurrent({ params: { tags: null, companyId }, session })
).map(event => event.name)

const earlierNames = async (companyId: number, session: SessionMaybeUser) => (
    await eventOperations.readManyArchivedPage({
        params: { paging: { page: { page: 0, pageSize: 12, cursor: null }, details: { tags: null, companyId } } },
        session,
    })
).map(event => event.name)

describe('the events of a company', () => {
    test('are its coming ones and its earlier ones, and no other company\'s', async () => {
        const company = await createCompany('Arrangør AS')
        const other = await createCompany('Annen Arrangør AS')
        await createEvent('Kommer snart', company.id, { startsIn: DAY })
        await createEvent('Kommer senere', company.id, { startsIn: 2 * DAY })
        await createEvent('Var i fjor', company.id, { startsIn: -300 * DAY })
        await createEvent('Ble holdt', company.id, { startsIn: -DAY, kind: 'ORDINARY' })
        await createEvent('Den andres', other.id)

        expect(await comingNames(company.id, Session.empty())).toEqual(['Kommer snart', 'Kommer senere'])
        expect(await earlierNames(company.id, Session.empty())).toEqual(['Ble holdt', 'Var i fjor'])
    })

    test('the public sees those published and not the drafts', async () => {
        const company = await createCompany('Utkastfirma AS')
        await createEvent('Publisert', company.id)
        await createEvent('Utkast', company.id, { published: false })
        await createEvent('Tidligere utkast', company.id, { published: false, startsIn: -DAY })

        expect(await comingNames(company.id, Session.empty())).toEqual(['Publisert'])
        expect(await earlierNames(company.id, Session.empty())).toEqual([])
    })

    test('one the public may not see is listed only for those who may', async () => {
        const company = await createCompany('Lukket Selskap AS')
        await createEvent('Bare for medlemmer', company.id, { canBeViewedBy: 'CAN_REGISTER' })
        const [{ conditions: [{ groupId }] }] = memberRequirements
        const member = testSession({ memberships: [{ groupId, order: currentOrder, active: true, admin: false }] })

        expect(await comingNames(company.id, Session.empty())).toEqual([])
        expect(await comingNames(company.id, member)).toEqual(['Bare for medlemmer'])
    })
})

describe('the earlier events', () => {
    test('come newest first, and a page at a time each of them once', async () => {
        const company = await createCompany('Sidevis AS')
        const sameStart = new Date(Date.now() - 3 * DAY)
        const newest = await createEvent('Nyligst', company.id, { startsIn: -DAY })
        const sameFirst = await createEvent('Samtidig først', company.id, { startsAt: sameStart })
        const sameSecond = await createEvent('Samtidig sist', company.id, { startsAt: sameStart })
        const older = await createEvent('Eldre', company.id, { startsIn: -5 * DAY })
        const oldest = await createEvent('Eldst', company.id, { startsIn: -9 * DAY })
        const pageSize = 2
        const pageAfter = async (lastId?: number) => (await eventOperations.readManyArchivedPage({
            params: {
                paging: {
                    page: lastId === undefined
                        ? { page: 0, pageSize, cursor: null }
                        : { page: 1, pageSize, cursor: { id: lastId } },
                    details: { tags: null, companyId: company.id },
                },
            },
            session: Session.empty(),
        })).map(event => event.id)

        const first = await pageAfter()
        const second = await pageAfter(first.at(-1))
        const third = await pageAfter(second.at(-1))
        expect([first, second, third]).toEqual([[newest.id, sameSecond.id], [sameFirst.id, older.id], [oldest.id]])
    })
})

describe('the page of a company', () => {
    test('has the kinds the company has events of, the career site\'s first, and a page of earlier ones', async () => {
        const company = await createCompany('Mange Arrangementer AS')
        await createEvent('Tidligere fest', company.id, { kind: 'ORDINARY', startsIn: -DAY })
        await createEvent('Kommende bedpres', company.id)
        await Promise.all(Array.from({ length: 13 }, (_, index) => createEvent(`Tidligere intervju ${index}`, company.id, {
            kind: 'SPEED_INTERVIEW',
            startsIn: -(index + 1) * DAY,
        })))

        const eventsOfKinds = await withServiceContext({ session: Session.empty() }, undefined, () => (
            readCompanyEvents(company.id)
        ))

        expect(eventsOfKinds.map(({ kind, coming, earlier }) => [kind, coming.length, earlier.length])).toEqual([
            ['COMPANY_PRESENTATION', 1, 0],
            ['SPEED_INTERVIEW', 0, 12],
            ['ORDINARY', 0, 1],
        ])
        expect(eventsOfKinds[1].earlier.map(event => event.name)).not.toContain('Tidligere intervju 12')
    })
})
