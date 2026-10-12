import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { jobAdOperations } from '@/services/career/jobAds/operations'
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'

// NOTE: This is file contains a lot of boiler plate which should be refactored to be more reusable.
// This is only the first step in wrinting our tests.

const CREATE_JOB_AD = {
    articleName: 'Vevcom Kakebaker',
    companyId: 1,
    description: 'Vevcom søker en erfaren kakebaker med kunnskap innenfor webutvikling?',
    type: 'PART_TIME' as const,
    applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
}

const UPDATED_JOB_AD = {
    active: false,
    companyId: 1,
    description: 'Vevcom søker en erfaren slaufe med kunnskap innenfor hytteturplanlegging?',
    type: 'FULL_TIME' as const,
}

beforeAll(async () => {
    // TODO: Refactor to maybe use a seed function?
    await prisma.company.create({
        data: {
            name: 'Vevcom AS',
            description: 'Vevcom AS er verdensledende innenfor webutvikling og kakebaking.',
            logo: {
                create: {}
            },
        },
    })
})

afterEach(async () => {
    const jobAds = await prisma.jobAd.findMany()

    for (const jobAd of jobAds) {
        await jobAdOperations.destroy({
            params: { id: jobAd.id },
            bypassAuth: true,
        })
    }
})

describe('job ads', () => {
    test('create with unauthenticated user', async () => {
        const countBefore = await prisma.jobAd.count()

        await expect(jobAdOperations.create({
            data: CREATE_JOB_AD,
            session: Session.empty()
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        const countAfter = await prisma.jobAd.count()
        expect(countAfter).toBe(countBefore)
    })

    test('create with authorized user', async () => {
        // TODO: Refactor to make use of seeded users.
        // Not using a seeded uses here is okay for now, but some other services
        // will need to use database data of the users.
        const session = Session.fromJsObject({
            memberships: [],
            permissions: ['JOBAD_ADMIN'],
            user: null,
        })

        await jobAdOperations.create({ data: CREATE_JOB_AD, session })

        const res = await prisma.jobAd.findFirst({})
        expect(res).toMatchObject(CREATE_JOB_AD)
    })

    test('(create and then) read with unauthenticated user', async () => {
        // TODO: To avoid fragile tests, this should be refactored to use a seeded job ad.
        const createRes = await jobAdOperations.create({
            data: CREATE_JOB_AD,
            bypassAuth: true
        })

        expect(jobAdOperations.read({ params: { id: createRes.id }, session: Session.empty() }))
            .rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('(create and then) read with authorized user', async () => {
        // TODO: To avoid fragile tests, this should be refactored to use a seeded job ad.
        const createRes = await jobAdOperations.create({
            data: CREATE_JOB_AD,
            bypassAuth: true
        })

        const session = Session.fromJsObject({
            memberships: [],
            permissions: ['JOBAD_USE'],
            user: null,
        })

        const readRes = await jobAdOperations.read({ params: { id: createRes.id }, session })
        expect(readRes).toMatchObject(CREATE_JOB_AD)
    })

    test('update with unauthenticated user', async () => {
        // TODO: To avoid fragile tests, this should be refactored to use a seeded job ad.
        const createRes = await jobAdOperations.create({
            data: CREATE_JOB_AD,
            bypassAuth: true
        })

        expect(jobAdOperations.update({
            params: {
                id: createRes.id,
            },
            data: UPDATED_JOB_AD,
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        const res = await prisma.jobAd.findFirst({})
        expect(res).toMatchObject(CREATE_JOB_AD)
    })

    test('update with authorized user', async () => {
        // TODO: To avoid fragile tests, this should be refactored to use a seeded job ad.
        const createRes = await jobAdOperations.create({
            data: CREATE_JOB_AD,
            bypassAuth: true
        })

        const session = Session.fromJsObject({
            memberships: [],
            permissions: ['JOBAD_ADMIN'],
            user: null,
        })

        await jobAdOperations.update({
            params: {
                id: createRes.id,
            },
            data: UPDATED_JOB_AD,
            session,
        })

        const res = await prisma.jobAd.findFirst({})
        expect(res).toMatchObject(UPDATED_JOB_AD)
    })

    test('destroy with unauthenticated user', async () => {
        // TODO: To avoid fragile tests, this should be refactored to use a seeded job ad.
        const countBefore = await prisma.jobAd.count()

        const createRes = await jobAdOperations.create({
            data: CREATE_JOB_AD,
            bypassAuth: true
        })

        await expect(jobAdOperations.destroy({ params: { id: createRes.id }, session: Session.empty() }))
            .rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        const countAfter = await prisma.jobAd.count()
        expect(countAfter).toBe(countBefore + 1)
    })

    test('destroy with authorized user', async () => {
        // TODO: To avoid fragile tests, this should be refactored to use a seeded job ad.
        const countBefore = await prisma.jobAd.count()

        const createRes = await jobAdOperations.create({
            data: CREATE_JOB_AD,
            bypassAuth: true
        })

        const session = Session.fromJsObject({
            memberships: [],
            permissions: ['JOBAD_ADMIN'],
            user: null,
        })

        await jobAdOperations.destroy({ params: { id: createRes.id }, session })

        const countAfter = await prisma.jobAd.count()
        expect(countAfter).toBe(countBefore)
    })
})
