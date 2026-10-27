import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { searchOperations } from '@/services/search/operations'
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

    test('a single category the session may not search gives no sections', async () => {
        const sections = await searchOperations.search({
            params: { query: 'søketest', category: 'companies' },
            session: sessionOf([]),
        })
        expect(sections).toEqual([])
    })
})
