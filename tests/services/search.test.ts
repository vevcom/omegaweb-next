import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { Smorekopp } from '@/services/error'
import { omegawebSearchOperations } from '@/services/omegawebSearch/operations'
import { careersSearchOperations } from '@/services/careers/search/operations'
import { eventOperations } from '@/services/events/operations'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { eventVariantOperations } from '@/services/events/variants/operations'
import { newsOperations } from '@/services/news/operations'
import { companyOperations } from '@/services/careers/companies/operations'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { omegaJobAdLinks } from '@/app/(omegaweb)/job-ads/links'
import { careerJobAdLinks } from '@/app/(careers)/career/job-ads/links'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { companyPresentationLinks } from '@/app/(careers)/career/company-presentations/links'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'

const COMPANY_NAME = 'Søketest Bedrift AS'
const OTHER_COMPANY_NAME = 'Søketest Konsern AS'
const JOB_AD_NAME = 'Søketest Stilling'

let currentOrder: number
let memberGroup: number
let jobAdId: number

const sessionOf = (permissions: Parameters<typeof Session.fromJsObject>[0]['permissions']) =>
    Session.fromJsObject({ user: null, permissions, memberships: [] })

/** An active member of `memberGroup`, holding no permissions at all. */
const sessionInMemberGroup = () => {
    const memberships: MembershipFiltered[] = [{ groupId: memberGroup, order: currentOrder, active: true, admin: false }]
    return Session.fromJsObject({ user: null, permissions: [], memberships })
}

beforeAll(async () => {
    const [company] = await Promise.all([COMPANY_NAME, OTHER_COMPANY_NAME].map(name => prisma.company.create({
        data: { name, description: 'En bedrift å søke etter.', logo: { create: {} } },
    })))
    const jobAd = await jobAdOperations.create({
        data: {
            companyId: company.id,
            articleName: JOB_AD_NAME,
            description: 'En stilling å søke etter.',
            type: 'PART_TIME',
            applicationDeadline: new Date(),
            rollingDueDate: false,
        },
        bypassAuth: true,
    })
    jobAdId = jobAd.id

    const order = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    currentOrder = order.order
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: 'search-test-group', shortName: 'search-test-group' } },
        },
    })
    memberGroup = group.id
})

describe('the search operation of a service', () => {
    test('finds every match by part of a name, ignoring case, as rows and as results', async () => {
        const { rows, searchResults } = await companyOperations.search()({
            params: { query: 'søketest' },
            session: sessionOf(['COMPANY_USE']),
        })
        expect(rows.map(company => company.name)).toEqual(
            expect.arrayContaining([COMPANY_NAME, OTHER_COMPANY_NAME])
        )
        expect(rows).toHaveLength(2)
        expect(searchResults.map(result => result.label)).toEqual(rows.map(company => company.name))
    })

    test('an empty query, blank or not, lists everything', async () => {
        const { rows } = await companyOperations.search()({
            params: { query: '  ' },
            session: sessionOf(['COMPANY_USE']),
        })
        expect(rows.map(company => company.name)).toEqual(
            expect.arrayContaining([COMPANY_NAME, OTHER_COMPANY_NAME])
        )
        expect(rows.length).toBe(await prisma.company.count())
    })

    test('the global search still needs text to search for', async () => {
        await expect(omegawebSearchOperations.searchAll({
            params: { query: '  ' },
            session: sessionOf(['COMPANY_USE']),
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('a limit caps the matches', async () => {
        const { rows } = await companyOperations.search()({
            params: { query: 'søketest', limit: 1 },
            session: sessionOf(['COMPANY_USE']),
        })
        expect(rows).toHaveLength(1)
    })

    test('is gated by the authorizer of the service', async () => {
        await expect(companyOperations.search()({
            params: { query: 'søketest' },
            session: sessionOf([]),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })
})

describe('global search', () => {
    test('finds a company by part of its name, ignoring case', async () => {
        const sections = await omegawebSearchOperations.searchAll({
            params: { query: 'søketest bedrift' },
            session: sessionOf(['COMPANY_USE']),
        })
        const companies = sections.find(section => section.category === 'companies')
        expect(companies?.results.map(result => result.label)).toEqual([COMPANY_NAME])
    })

    test('leaves out the categories the session may not search', async () => {
        const sections = await omegawebSearchOperations.searchAll({
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
                waitingList: false,
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
        const sections = await omegawebSearchOperations.searchAll({
            params: { query: 'søketest', category: 'companies' },
            session: sessionOf([]),
        })
        expect(sections).toEqual([])
    })

    test('the career site searches only the categories it has pages for', async () => {
        const session = sessionOf(['COMPANY_USE', 'JOBAD_USE', 'COMMITTEE_USE', 'USERS_USE'])
        const careers = await careersSearchOperations.searchAll({ params: { query: 'søketest' }, session })
        expect(careers.map(section => section.category).sort()).toEqual(['companies', 'events', 'jobAds'])
        expect(careers.find(section => section.category === 'companies')?.results.map(result => result.label).sort())
            .toEqual([COMPANY_NAME, OTHER_COMPANY_NAME].sort())

        const omega = await omegawebSearchOperations.searchAll({ params: { query: 'søketest' }, session })
        expect(omega.map(section => section.category)).toContain('committees')
    })

    test('the career site finds only the company presentations, linking to its own pages', async () => {
        const group = await prisma.group.findFirstOrThrow()
        const tag = await prisma.eventTag.findUniqueOrThrow({ where: { special: 'COMPANY_PRESENTATION' } })
        const HOUR = 60 * 60 * 1000
        const createEvent = (name: string, tagIds: number[]) => eventOperations.create({
            data: {
                name,
                location: 'Lophtet',
                eventStart: new Date(Date.now() + 7 * 24 * HOUR),
                eventEnd: new Date(Date.now() + 7 * 24 * HOUR + 2 * HOUR),
                canBeViewedBy: 'ALL',
                takesRegistration: false,
                waitingList: false,
                tagIds,
                visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: group.id }] }],
            },
            bypassAuth: true,
        })
        const presentation = await createEvent('Søketest Bedpres', [tag.id])
        await createEvent('Søketest Fest', [])

        const params = { query: 'søketest', category: 'events' as const }
        const session = sessionOf(['EVENT_ADMIN'])
        const [omega, careers] = await Promise.all([
            omegawebSearchOperations.searchAll({ params, session }),
            careersSearchOperations.searchAll({ params, session }),
        ])
        const labelsOf = (sections: typeof omega) => sections[0]?.results.map(result => result.label) ?? []
        expect(labelsOf(omega)).toEqual(expect.arrayContaining(['Søketest Bedpres', 'Søketest Fest']))
        expect(labelsOf(careers)).toEqual(['Søketest Bedpres'])
        expect(careers[0]?.results[0]?.href).toBe(companyPresentationLinks.event(presentation))
        expect(omega[0]?.results.find(result => result.label === 'Søketest Bedpres')?.href)
            .toBe(omegaEventLinks.event(presentation))
    })

    test('job ad results link to the job ad pages of the site searched', async () => {
        const params = { query: JOB_AD_NAME, category: 'jobAds' as const }
        const session = sessionOf(['JOBAD_USE'])
        const [omega, careers] = await Promise.all([
            omegawebSearchOperations.searchAll({ params, session }),
            careersSearchOperations.searchAll({ params, session }),
        ])
        const hrefOf = (sections: typeof omega) => sections[0]?.results.find(result => result.label === JOB_AD_NAME)?.href
        const jobAd = { articleName: JOB_AD_NAME, id: jobAdId }
        expect(hrefOf(omega)).toBe(omegaJobAdLinks.jobAd(jobAd))
        expect(hrefOf(careers)).toBe(careerJobAdLinks.jobAd(jobAd))
        expect(hrefOf(careers)).not.toBe(hrefOf(omega))
    })

    test('a category outside the site\'s search is a bad parameter', async () => {
        await expect(careersSearchOperations.searchAll({
            params: { query: 'søketest', category: 'committees' },
            session: sessionOf(['COMMITTEE_USE']),
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })
})

describe('search respects a provider\'s own visibility filter', () => {
    test('a restricted, published news article is found by a member, not by anyone else', async () => {
        const news = await newsOperations.create({
            data: {
                name: 'Søketest Nyhet',
                description: 'En nyhet bare noen kan se.',
                visibilityRegularRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: memberGroup }] }],
                visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: memberGroup }] }],
            },
            bypassAuth: true,
        })
        await newsOperations.setPublished({ params: { id: news.id }, data: { published: true }, bypassAuth: true })

        const { rows: memberRows } = await newsOperations.search()({
            params: { query: 'søketest nyhet' },
            session: sessionInMemberGroup(),
        })
        expect(memberRows.map(row => row.id)).toContain(news.id)

        const { rows: outsiderRows } = await newsOperations.search()({
            params: { query: 'søketest nyhet' },
            session: sessionOf([]),
        })
        expect(outsiderRows.map(row => row.id)).not.toContain(news.id)

        const { rows: adminRows } = await newsOperations.search()({
            params: { query: 'søketest nyhet' },
            session: sessionOf(['NEWS_ADMIN']),
        })
        expect(adminRows.map(row => row.id)).toContain(news.id)
    })

    test('a restricted, published event is found by a member, not by anyone else', async () => {
        const HOUR = 60 * 60 * 1000
        const event = await eventOperations.create({
            data: {
                name: 'Søketest Begrenset Arrangement',
                location: 'Lophtet',
                eventStart: new Date(Date.now() + 7 * 24 * HOUR),
                eventEnd: new Date(Date.now() + 7 * 24 * HOUR + 2 * HOUR),
                canBeViewedBy: 'CAN_REGISTER',
                takesRegistration: false,
                waitingList: false,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        const variant = await eventVariantOperations.create({
            params: { eventId: event.id },
            data: {
                name: 'Påmelding',
                registrationStart: new Date(Date.now() - HOUR),
                registrationEnd: new Date(Date.now() + 24 * HOUR),
            },
            bypassAuth: true,
        })
        await eventQuotaOperations.create({
            params: { variantId: variant.id },
            data: {
                name: 'Medlemmer',
                places: 10,
                visibilityRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: memberGroup }] }],
            },
            bypassAuth: true,
        })
        await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })

        const { rows: memberRows } = await eventOperations.search(omegaEventPages)({
            params: { query: 'søketest begrenset' },
            session: sessionInMemberGroup(),
        })
        expect(memberRows.map(row => row.id)).toContain(event.id)

        const { rows: outsiderRows } = await eventOperations.search(omegaEventPages)({
            params: { query: 'søketest begrenset' },
            session: sessionOf([]),
        })
        expect(outsiderRows.map(row => row.id)).not.toContain(event.id)

        const { rows: adminRows } = await eventOperations.search(omegaEventPages)({
            params: { query: 'søketest begrenset' },
            session: sessionOf(['EVENT_ADMIN']),
        })
        expect(adminRows.map(row => row.id)).toContain(event.id)
    })
})
