import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { companyOperations } from '@/services/careers/companies/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import { File } from 'node:buffer'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'
import type { Page } from '@/lib/paging/types'

const NAME_MARKER = 'Tiertest'

const COMPANY_NAMES = [
    `${NAME_MARKER} Alfa AS`,
    `${NAME_MARKER} Beta AS`,
    `${NAME_MARKER} Gamma AS`,
    `${NAME_MARKER} Delta AS`,
] as const

const companyAdmin = Session.fromJsObject({ user: null, permissions: ['COMPANY_ADMIN'], memberships: [] })

// Minimal valid PNG (1x1 red pixel)
const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x9c, 0xe3, 0xbf, 0x59, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82
])

const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')

const companyIds: Record<string, number> = {}

async function createCompany(name: string) {
    const company = await prisma.company.create({
        data: {
            name,
            description: `${name} er en bedrift.`,
        },
    })
    companyIds[name] = company.id
}

async function setSponsorTier(name: string, sponsorTier: CompanySponsorTier) {
    await companyOperations.updateSponsorTier({
        params: { id: companyIds[name] },
        data: { sponsorTier },
        bypassAuth: true,
    })
}

async function readPage(page: Page<number, { id: number }>) {
    return await companyOperations.readPage({
        params: {
            paging: {
                page,
                details: { name: NAME_MARKER },
            },
        },
        bypassAuth: true,
    })
}

async function readTiers() {
    const companies = await readPage({ pageSize: COMPANY_NAMES.length, page: 0, cursor: null })
    return companies.map(company => [company.name, company.sponsorTier])
}

beforeAll(async () => {
    for (const name of COMPANY_NAMES) {
        await createCompany(name)
    }
})

describe('company sponsor tiers', () => {
    test('a company starts out on the ordinary tier', async () => {
        const company = await prisma.company.findUniqueOrThrow({
            where: { id: companyIds[`${NAME_MARKER} Alfa AS`] },
        })
        expect(company.sponsorTier).toBe('NONE')
    })

    test('changing the tier is not open to just anyone', async () => {
        await expect(companyOperations.updateSponsorTier({
            params: { id: companyIds[`${NAME_MARKER} Alfa AS`] },
            data: { sponsorTier: 'MAIN' },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        const company = await prisma.company.findUniqueOrThrow({
            where: { id: companyIds[`${NAME_MARKER} Alfa AS`] },
        })
        expect(company.sponsorTier).toBe('NONE')
    })

    test('promoting a new main sponsor demotes the sitting one', async () => {
        await setSponsorTier(`${NAME_MARKER} Alfa AS`, 'MAIN')
        await setSponsorTier(`${NAME_MARKER} Beta AS`, 'MAIN')

        const companies = await prisma.company.findMany({
            where: { sponsorTier: 'MAIN', name: { contains: NAME_MARKER } },
        })
        expect(companies).toHaveLength(1)
        expect(companies[0].id).toBe(companyIds[`${NAME_MARKER} Beta AS`])

        const demoted = await prisma.company.findUniqueOrThrow({
            where: { id: companyIds[`${NAME_MARKER} Alfa AS`] },
        })
        expect(demoted.sponsorTier).toBe('SPONSOR')
    })

    test('the listing puts the main sponsor first, then the sponsors, then the rest', async () => {
        await setSponsorTier(`${NAME_MARKER} Alfa AS`, 'NONE')
        await setSponsorTier(`${NAME_MARKER} Beta AS`, 'SPONSOR')
        await setSponsorTier(`${NAME_MARKER} Gamma AS`, 'SPONSOR')
        await setSponsorTier(`${NAME_MARKER} Delta AS`, 'MAIN')

        expect(await readTiers()).toEqual([
            [`${NAME_MARKER} Delta AS`, 'MAIN'],
            [`${NAME_MARKER} Beta AS`, 'SPONSOR'],
            [`${NAME_MARKER} Gamma AS`, 'SPONSOR'],
            [`${NAME_MARKER} Alfa AS`, 'NONE'],
        ])
    })

    test('paging past the sponsors keeps the order', async () => {
        const firstPage = await readPage({ pageSize: 2, page: 0, cursor: null })
        const secondPage = await readPage({
            pageSize: 2,
            page: 1,
            cursor: { id: firstPage[firstPage.length - 1].id },
        })

        expect(firstPage.map(company => company.name)).toEqual([
            `${NAME_MARKER} Delta AS`,
            `${NAME_MARKER} Beta AS`,
        ])
        expect(secondPage.map(company => company.name)).toEqual([
            `${NAME_MARKER} Gamma AS`,
            `${NAME_MARKER} Alfa AS`,
        ])
    })

    test('two promotions racing for the main slot still leave one main sponsor', async () => {
        await Promise.all([
            setSponsorTier(`${NAME_MARKER} Alfa AS`, 'MAIN'),
            setSponsorTier(`${NAME_MARKER} Beta AS`, 'MAIN'),
        ])

        const mainSponsors = await prisma.company.findMany({
            where: { sponsorTier: 'MAIN', name: { contains: NAME_MARKER } },
        })
        expect(mainSponsors).toHaveLength(1)
    })
})

describe('company logos', () => {
    async function uploadLogo(id: number, file: File) {
        return await companyOperations.updateLogo({
            params: { id },
            data: { imageFile: file },
            session: companyAdmin,
        })
    }

    test('a company starts without a logo', async () => {
        const company = await companyOperations.create({
            data: { name: 'Logotest Uten AS', description: '' },
            session: companyAdmin,
        })
        expect(company.logoImageId).toBeNull()
    })

    test('uploading a logo is not open to just anyone', async () => {
        const company = await prisma.company.create({ data: { name: 'Logotest Stengt AS', description: '' } })
        await expect(companyOperations.updateLogo({
            params: { id: company.id },
            data: { imageFile: new File([pngBuffer], 'logo.png', { type: 'image/png' }) },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('a logo goes in the company logos collection, and a new one replaces it', async () => {
        const company = await prisma.company.create({ data: { name: 'Logotest Bytte AS', description: '' } })

        const first = await uploadLogo(company.id, new File([pngBuffer], 'logo.png', { type: 'image/png' }))
        const collection = await prisma.imageCollection.findUniqueOrThrow({ where: { id: first.collectionId } })
        expect(collection.special).toBe('COMPANYLOGOS')

        const second = await uploadLogo(company.id, new File([svgBuffer], 'logo.svg', { type: 'image/svg+xml' }))
        expect(second.type).toBe('SVG')
        const updated = await prisma.company.findUniqueOrThrow({ where: { id: company.id } })
        expect(updated.logoImageId).toBe(second.id)
        expect(await prisma.image.count({ where: { id: first.id } })).toBe(0)
    })

    test('deleting a company removes its logo', async () => {
        const company = await prisma.company.create({ data: { name: 'Logotest Slett AS', description: '' } })
        const logo = await uploadLogo(company.id, new File([pngBuffer], 'logo.png', { type: 'image/png' }))

        await companyOperations.destroy({ params: { id: company.id }, session: companyAdmin })

        expect(await prisma.company.count({ where: { id: company.id } })).toBe(0)
        expect(await prisma.image.count({ where: { id: logo.id } })).toBe(0)
    })
})

describe('reading a company', () => {
    test('a company is read with its logo, by those who may see companies', async () => {
        const id = companyIds[`${NAME_MARKER} Alfa AS`]
        const company = await companyOperations.read({
            params: { id },
            session: Session.fromJsObject({ user: null, permissions: ['COMPANY_USE'], memberships: [] }),
        })
        expect(company.name).toBe(`${NAME_MARKER} Alfa AS`)
        expect(company.logoImage).toBeNull()

        await expect(companyOperations.read({ params: { id }, session: Session.empty() }))
            .rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('a company that does not exist is not found', async () => {
        await expect(companyOperations.read({ params: { id: -1 }, bypassAuth: true }))
            .rejects.toThrow(new Smorekopp('NOT FOUND'))
    })
})
