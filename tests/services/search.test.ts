import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { searchOperations } from '@/services/search/operations'
import { eventOperations } from '@/services/events/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'

const COMPANY_NAME = 'Søketest Bedrift AS'

const sessionOf = (permissions: Parameters<typeof Session.fromJsObject>[0]['permissions']) =>
    Session.fromJsObject({ user: null, permissions, memberships: [] })

beforeAll(async () => {
    await prisma.company.create({
        data: { name: COMPANY_NAME, description: 'En bedrift å søke etter.', logo: { create: {} } },
    })
})

describe('global search', () => {
    test('finds a company by part of its name, ignoring case', async () => {
        const sections = await searchOperations.search({
            params: { query: 'søketest' },
            session: sessionOf(['COMPANY_USE']),
        })
        const companies = sections.find(section => section.category === 'companies')
        expect(companies?.results.map(result => result.label)).toEqual([COMPANY_NAME])
    })

    test('leaves out the categories the session may not search', async () => {
        const sections = await searchOperations.search({
            params: { query: 'søketest' },
            session: sessionOf(['COMPANY_USE']),
        })
        const categories = sections.map(section => section.category)
        expect(categories).toContain('companies')
        expect(categories).not.toContain('users')
        expect(categories).not.toContain('committees')
        expect(categories).not.toContain('jobAds')
    })

    test('the current events can be narrowed to part of a name, ignoring case', async () => {
        const group = await prisma.group.findFirstOrThrow()
        const HOUR = 60 * 60 * 1000
        const createEvent = (name: string) => eventOperations.create({
            data: {
                name,
                location: 'Lophtet',
                eventStart: new Date(Date.now() + 7 * 24 * HOUR),
                eventEnd: new Date(Date.now() + 7 * 24 * HOUR + 2 * HOUR),
                canBeViewedBy: 'ALL',
                takesRegistration: false,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: group.id }] }],
            },
            bypassAuth: true,
        })
        await createEvent('Søketest Julebord')
        await createEvent('Søketest Sommerfest')

        const events = await eventOperations.readManyCurrent({
            params: { tags: null, name: 'søketest jule' },
            bypassAuth: true,
        })
        expect(events.map(event => event.name)).toEqual(['Søketest Julebord'])
    })

    test('a single category the session may not search gives no sections', async () => {
        const sections = await searchOperations.search({
            params: { query: 'søketest', category: 'companies' },
            session: sessionOf([]),
        })
        expect(sections).toEqual([])
    })
})
