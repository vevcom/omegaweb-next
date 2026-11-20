import { createAdministrators } from 'tests/eventSetup'
import { testSession } from 'tests/utils'
import { Session } from '@/auth/session/Session'
import { companySessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { REGISTRATION_READER_TYPE } from '@/services/events/registration/constants'
import { eventSeatingOperations } from '@/services/events/seating/operations'
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

async function sessionOfCompanyUser(companyId: number, email: string) {
    const companyUser = await prisma.companyUser.create({
        data: {
            companyId,
            email,
            firstname: 'Kari',
            lastname: 'Nordmann',
            credentials: { create: { passwordHash: 'not a hash anyone can match' } },
        },
    })
    return Session.fromToken(await companySessionTokenOf(companyUser.id))
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

describe('a company user', () => {
    test('sees the drafts of their own company, and a user of another company sees what the public does', async () => {
        const company = await createCompany('Egne Utkast AS')
        const other = await createCompany('Fremmede AS')
        const own = await sessionOfCompanyUser(company.id, 'egen@example.com')
        const outsider = await sessionOfCompanyUser(other.id, 'fremmed@example.com')
        await createEvent('Publisert', company.id, { startsIn: DAY })
        const draft = await createEvent('Utkast', company.id, { published: false, startsIn: 2 * DAY })
        await createEvent('Tidligere utkast', company.id, { published: false, startsIn: -DAY })
        await createEvent('Den andres utkast', other.id, { published: false })

        expect(await comingNames(company.id, own)).toEqual(['Publisert', 'Utkast'])
        expect(await earlierNames(company.id, own)).toEqual(['Tidligere utkast'])
        expect(await comingNames(other.id, own)).toEqual([])
        expect(await comingNames(company.id, outsider)).toEqual(await comingNames(company.id, Session.empty()))
        expect(await earlierNames(company.id, outsider)).toEqual([])

        await expect(eventOperations.read({ params: { id: draft.id }, session: own }))
            .resolves.toMatchObject({ name: 'Utkast', published: false })
        await expect(eventOperations.read({ params: { id: draft.id }, session: outsider }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('is not named when an event is refused to someone else', async () => {
        const company = await createCompany('Avviser AS')
        const other = await createCompany('Avvist AS')
        const outsider = await sessionOfCompanyUser(other.id, 'avvist@example.com')
        const withCompany = await createEvent('Utkast med bedrift', company.id, { published: false })
        const withoutCompany = await eventOperations.create({
            data: { name: 'Utkast uten bedrift', visibilityAdminRequirements },
            bypassAuth: true,
        })
        const refusal = {
            errors: [{
                message: 'Du trenger tillatelse \'EVENT_ADMIN\' for å få tilgang '
                    + 'eller Du har ikke tilgang til denne ressursen',
            }],
        }

        await expect(eventOperations.read({ params: { id: withCompany.id }, session: outsider }))
            .rejects.toMatchObject(refusal)
        await expect(eventOperations.read({ params: { id: withoutCompany.id }, session: Session.empty() }))
            .rejects.toMatchObject(refusal)
    })

    test('sees an event of their own company that only those who can register see', async () => {
        const company = await createCompany('Egne Medlemmer AS')
        const own = await sessionOfCompanyUser(company.id, 'medlemmer@example.com')
        await createEvent('Bare for medlemmer', company.id, { canBeViewedBy: 'CAN_REGISTER' })

        expect(await comingNames(company.id, own)).toEqual(['Bare for medlemmer'])
    })

    test('only reads their company\'s event, and may not change, publish, delete, seat or see registrations', async () => {
        const company = await createCompany('Bare Lesing AS')
        const own = await sessionOfCompanyUser(company.id, 'lesing@example.com')
        const { id } = await createEvent('Les, ikke rør', company.id, { published: false, canBeViewedBy: 'CAN_REGISTER' })
        const registrations = {
            page: { pageSize: 10, page: 0, cursor: null },
            details: { eventId: id, type: REGISTRATION_READER_TYPE.REGISTRATIONS },
        } as const
        const refused = new Smorekopp('UNAUTHORIZED')

        await expect(eventOperations.update({ params: { id }, data: { name: 'Endret' }, session: own }))
            .rejects.toThrow(refused)
        await expect(eventOperations.saveSetup({ params: { id }, data: { name: 'Endret' }, session: own }))
            .rejects.toThrow(refused)
        await expect(eventOperations.setPublished({ params: { id }, data: { published: true }, session: own }))
            .rejects.toThrow(refused)
        await expect(eventOperations.destroy({ params: { id }, session: own })).rejects.toThrow(refused)
        await expect(eventOperations.readStatistics({ params: { id }, session: own })).rejects.toThrow(refused)
        await expect(eventRegistrationOperations.createGuest({
            params: { eventId: id },
            data: { name: 'Gjest', note: '' },
            session: own,
        })).rejects.toThrow(refused)
        await expect(eventRegistrationOperations.readPage({ params: { paging: registrations }, session: own }))
            .rejects.toThrow(refused)
        await expect(eventRegistrationOperations.readPageDetailed({ params: { paging: registrations }, session: own }))
            .rejects.toThrow(refused)
        await expect(eventSeatingOperations.readOwn({ params: { id }, session: own })).rejects.toThrow(refused)
        await expect(eventSeatingOperations.updateWishes({ params: { id }, data: { wishes: [] }, session: own }))
            .rejects.toThrow(refused)
        await expect(eventOperations.read({ params: { id }, bypassAuth: true }))
            .resolves.toMatchObject({ name: 'Les, ikke rør', published: false })
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
