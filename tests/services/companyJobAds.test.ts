import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { companySessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { testSession } from 'tests/utils'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { AnySession } from '@/auth/session/Session'

const jobAdReader = testSession({ permissions: ['JOBAD_USE'] })
const visitor = Session.empty()

let companyId: number
let member: AnySession
let otherCompanyUser: AnySession
let newestActiveId: number
let olderActiveId: number
let inactiveId: number

beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: 'Annonsetest AS', description: '' } })
    const otherCompany = await prisma.company.create({ data: { name: 'Annonsetest To AS', description: '' } })
    companyId = company.id
    member = await companyUserSessionOf(companyId, 'annonse-medlem@example.com')
    otherCompanyUser = await companyUserSessionOf(otherCompany.id, 'annonse-annen@example.com')

    olderActiveId = await createJobAd(companyId, 'Eldre aktiv', { active: true, createdAt: '2026-01-01T00:00:00Z' })
    inactiveId = await createJobAd(companyId, 'Utløpt', { active: false, createdAt: '2026-03-01T00:00:00Z' })
    newestActiveId = await createJobAd(companyId, 'Nyeste aktiv', { active: true, createdAt: '2026-02-01T00:00:00Z' })
    await createJobAd(otherCompany.id, 'Annen bedrift', { active: true, createdAt: '2026-02-01T00:00:00Z' })
})

describe('reading a job ad', () => {
    test('a user of its company reads it without JOBAD_USE, also when it is inactive', async () => {
        expect(member.permissions).not.toContain('JOBAD_USE')
        const jobAd = await jobAdOperations.read({ params: { id: inactiveId }, session: member })
        expect(jobAd).toMatchObject({ id: inactiveId, active: false, companyId })
    })

    test('a user of another company may not', async () => {
        await expect(jobAdOperations.read({ params: { id: newestActiveId }, session: otherCompanyUser }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('JOBAD_USE reads it, and a visitor without it may not', async () => {
        const jobAd = await jobAdOperations.read({ params: { id: inactiveId }, session: jobAdReader })
        expect(jobAd.id).toBe(inactiveId)
        await expect(jobAdOperations.read({ params: { id: inactiveId }, session: visitor }))
            .rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })
})

describe('reading the job ads of a company', () => {
    test('they are every ad of the company, the active ones newest first and then the inactive', async () => {
        const jobAds = await jobAdOperations.readOfCompany({ params: { companyId }, session: member })
        expect(jobAds.map(jobAd => jobAd.id)).toEqual([newestActiveId, olderActiveId, inactiveId])
    })

    test('a user of another company may not read them', async () => {
        await expect(jobAdOperations.readOfCompany({ params: { companyId }, session: otherCompanyUser }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('JOBAD_USE reads them, and a visitor without it may not', async () => {
        const jobAds = await jobAdOperations.readOfCompany({ params: { companyId }, session: jobAdReader })
        expect(jobAds).toHaveLength(3)
        await expect(jobAdOperations.readOfCompany({ params: { companyId }, session: visitor }))
            .rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })
})

async function companyUserSessionOf(ofCompanyId: number, email: string) {
    const companyUser = await prisma.companyUser.create({
        data: {
            companyId: ofCompanyId,
            email,
            firstname: 'Kari',
            lastname: 'Nordmann',
            credentials: { create: { passwordHash: 'not a hash anyone can match' } },
        },
    })
    return Session.fromToken(await companySessionTokenOf(companyUser.id))
}

async function createJobAd(ofCompanyId: number, articleName: string, { active, createdAt }: {
    active: boolean,
    createdAt: string,
}) {
    const jobAd = await jobAdOperations.create({
        data: {
            articleName,
            companyId: ofCompanyId,
            description: 'Vevcom søker en kakebaker',
            type: 'FULL_TIME',
            applicationDeadline: new Date('2027-01-01T00:00:00Z'),
            rollingDueDate: false,
        },
        bypassAuth: true,
    })
    await prisma.jobAd.update({ where: { id: jobAd.id }, data: { active } })
    await prisma.article.update({ where: { id: jobAd.articleId }, data: { createdAt: new Date(createdAt) } })
    return jobAd.id
}
