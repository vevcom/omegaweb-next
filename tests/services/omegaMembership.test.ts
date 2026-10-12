import { admissionOperations } from '@/services/admission/operations'
import { allAdmissions } from '@/services/admission/constants'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import { userOperations } from '@/services/users/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { beforeAll, describe, expect, test } from '@jest/globals'

async function createTestUser(username: string) {
    return userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
}

const readOmegaMemberships = (userId: number) => prisma.membership.findMany({
    where: {
        userId,
        active: true,
        group: { groupType: 'OMEGA_MEMBERSHIP_GROUP' },
    },
    select: {
        order: true,
        group: { select: { omegaMembershipGroup: { select: { omegaMembershipLevel: true } } } },
    },
})

const dropOmegaMemberships = (userId: number) => prisma.membership.deleteMany({
    where: { userId, group: { groupType: 'OMEGA_MEMBERSHIP_GROUP' } },
})

describe('readUserLevel', () => {
    // The omega membership service asks the admission service which level a broken membership
    // should be rewritten to, and the admission service asks it back to promote a user who has
    // just sat their last trial. Both directions are only used from inside an operation, so the
    // import cycle resolves - this fails at module load if that ever stops being true.
    test('the admission and omega membership services can both be imported', () => {
        expect(typeof admissionOperations.userCompletedTrials).toBe('function')
        expect(typeof omegaMembershipGroupOperations.readUserLevel).toBe('function')
    })

    test('leaves a user holding exactly one membership alone', async () => {
        const user = await createTestUser('omegamembershipone')
        const before = await readOmegaMemberships(user.id)
        expect(before).toHaveLength(1)

        const resolved = await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id },
            bypassAuth: true,
        })

        expect(resolved.level).toBe('DEN_GEMENE_HOB')
        expect(resolved.order).toBe(before[0].order)
    })

    test('a user holding no membership is written back as a soelle', async () => {
        const user = await createTestUser('omegamembershiptwo')
        await dropOmegaMemberships(user.id)

        const resolved = await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id },
            bypassAuth: true,
        })

        expect(resolved.level).toBe('SOELLE')
        const after = await readOmegaMemberships(user.id)
        expect(after).toHaveLength(1)
        expect(after[0].group.omegaMembershipGroup?.omegaMembershipLevel).toBe('SOELLE')
    })

    test('a user who has sat every trial is written back as a sysken', async () => {
        const user = await createTestUser('omegamembershipthree')
        await prisma.admissionTrial.createMany({
            data: [
                { userId: user.id, admission: 'PLIKTTIAENESTE' },
                { userId: user.id, admission: 'PROEVELSEN' },
            ],
        })
        await dropOmegaMemberships(user.id)

        const resolved = await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id },
            bypassAuth: true,
        })

        expect(resolved.level).toBe('SYSKEN')
        const after = await readOmegaMemberships(user.id)
        expect(after).toHaveLength(1)
        expect(after[0].group.omegaMembershipGroup?.omegaMembershipLevel).toBe('SYSKEN')
    })

    test('a user holding several memberships is collapsed down to one', async () => {
        const user = await createTestUser('omegamembershipfour')
        const omegaMembershipGroups = await prisma.omegaMembershipGroup.findMany()
        const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })

        await dropOmegaMemberships(user.id)
        await prisma.membership.createMany({
            data: omegaMembershipGroups.map(group => ({
                userId: user.id,
                groupId: group.groupId,
                order,
                admin: false,
                active: true,
            })),
        })
        expect(await readOmegaMemberships(user.id)).toHaveLength(omegaMembershipGroups.length)

        const resolved = await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id },
            bypassAuth: true,
        })

        expect(resolved.level).toBe('SOELLE')
        expect(await readOmegaMemberships(user.id)).toHaveLength(1)
    })
})

describe('userCompletedTrials', () => {
    test('is false until every admission has been sat', async () => {
        const user = await createTestUser('omegamembershipfive')
        const completed = () => admissionOperations.userCompletedTrials({
            params: { userId: user.id },
            bypassAuth: true,
        })

        expect(await completed()).toBe(false)

        await prisma.admissionTrial.create({ data: { userId: user.id, admission: 'PLIKTTIAENESTE' } })
        expect(await completed()).toBe(false)

        await prisma.admissionTrial.create({ data: { userId: user.id, admission: 'PROEVELSEN' } })
        expect(await completed()).toBe(true)
    })
})

const countTrials = (userId: number) => prisma.admissionTrial.count({ where: { userId } })

const setLevel = (userId: number, omegaMembershipLevel: 'SOELLE' | 'SYSKEN' | 'DEN_GEMENE_HOB') =>
    omegaMembershipGroupOperations.updateUserLevel({
        params: { userId, omegaMembershipLevel, onlyUpgrade: false },
        bypassAuth: true,
    })

describe('updateUserLevel resets admission trials', () => {
    test('demoting a sysken to soelle clears the trials they sat', async () => {
        const user = await createTestUser('omegamembershipsix')
        await prisma.admissionTrial.createMany({
            data: [
                { userId: user.id, admission: 'PLIKTTIAENESTE' },
                { userId: user.id, admission: 'PROEVELSEN' },
            ],
        })
        await setLevel(user.id, 'SYSKEN')
        expect(await countTrials(user.id)).toBe(2)

        await setLevel(user.id, 'SOELLE')

        expect(await countTrials(user.id)).toBe(0)
    })

    test('demoting to den gemene hob clears them too', async () => {
        const user = await createTestUser('omegamembershipseven')
        await prisma.admissionTrial.createMany({
            data: [
                { userId: user.id, admission: 'PLIKTTIAENESTE' },
                { userId: user.id, admission: 'PROEVELSEN' },
            ],
        })
        await setLevel(user.id, 'SYSKEN')

        await setLevel(user.id, 'DEN_GEMENE_HOB')

        expect(await countTrials(user.id)).toBe(0)
    })

    test('promoting to sysken keeps the ones already sat', async () => {
        const user = await createTestUser('omegamembershipeight')
        await setLevel(user.id, 'SOELLE')
        await prisma.admissionTrial.createMany({
            data: [
                { userId: user.id, admission: 'PLIKTTIAENESTE' },
                { userId: user.id, admission: 'PROEVELSEN' },
            ],
        })

        await setLevel(user.id, 'SYSKEN')

        expect(await countTrials(user.id)).toBe(2)
    })

    test('promoting to sysken credits the trials the user never sat', async () => {
        const user = await createTestUser('omegamembershipthirteen')
        await setLevel(user.id, 'SOELLE')
        expect(await countTrials(user.id)).toBe(0)

        await setLevel(user.id, 'SYSKEN')

        // A sysken without the full set would read back as a soelle the next time the membership
        // has to be worked out.
        expect(await countTrials(user.id)).toBe(allAdmissions.length)
        expect(await admissionOperations.userCompletedTrials({
            params: { userId: user.id }, bypassAuth: true,
        })).toBe(true)
    })

    test('a trial the user really sat is not re-dated by the promotion', async () => {
        const user = await createTestUser('omegamembershipfourteen')
        await setLevel(user.id, 'SOELLE')
        const sat = await prisma.admissionTrial.create({
            data: { userId: user.id, admission: 'PLIKTTIAENESTE', datetime: new Date('2020-01-01') },
        })

        await setLevel(user.id, 'SYSKEN')

        const trials = await prisma.admissionTrial.findMany({ where: { userId: user.id } })
        expect(trials).toHaveLength(allAdmissions.length)
        expect(trials.find(trial => trial.admission === 'PLIKTTIAENESTE')?.datetime).toEqual(sat.datetime)
    })
})

describe('createTrial only accepts a soelle', () => {
    // createTrial writes the acting user onto the trial as `registeredBy`, which is why its
    // authorizer requires a session user - so the tests hand it one rather than bypassing auth.
    let registrarSession: ReturnType<typeof Session.fromJsObject>

    beforeAll(async () => {
        registrarSession = Session.fromJsObject({
            memberships: [],
            permissions: ['ADMISSION_USE'],
            user: await createTestUser('omegaregistrar'),
        })
    })

    const createTrial = (userId: number, admission: 'PLIKTTIAENESTE' | 'PROEVELSEN' = 'PLIKTTIAENESTE') =>
        admissionOperations.createTrial({
            params: { admission },
            data: { userId },
            session: registrarSession,
        })

    test('a soelle may sit a trial', async () => {
        const user = await createTestUser('omegamembershipnine')
        await setLevel(user.id, 'SOELLE')

        await createTrial(user.id)

        expect(await countTrials(user.id)).toBe(1)
    })

    test('den gemene hob may not', async () => {
        const user = await createTestUser('omegamembershipten')
        expect((await readOmegaMemberships(user.id))[0]
            .group.omegaMembershipGroup?.omegaMembershipLevel).toBe('DEN_GEMENE_HOB')

        await expect(createTrial(user.id)).rejects.toThrow(Smorekopp)
        expect(await countTrials(user.id)).toBe(0)
    })

    test('a sysken may not', async () => {
        const user = await createTestUser('omegamembositeleven')
        await setLevel(user.id, 'SYSKEN')
        // Becoming a sysken credits the full set, so what is checked is that the rejected call
        // leaves them exactly as they were rather than that they hold none.
        const before = await countTrials(user.id)

        await expect(createTrial(user.id)).rejects.toThrow(Smorekopp)
        expect(await countTrials(user.id)).toBe(before)
    })

    test('sitting the last trial makes the soelle a sysken', async () => {
        const user = await createTestUser('omegamembershiptwelve')
        await setLevel(user.id, 'SOELLE')

        await createTrial(user.id, 'PLIKTTIAENESTE')
        expect((await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id }, bypassAuth: true,
        })).level).toBe('SOELLE')

        await createTrial(user.id, 'PROEVELSEN')

        expect((await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id }, bypassAuth: true,
        })).level).toBe('SYSKEN')
        expect(await countTrials(user.id)).toBe(2)
    })
})

describe('inferUserLevel', () => {
    const inferLevel = (userId: number) => omegaMembershipGroupOperations.inferUserLevel({
        params: { userId },
        bypassAuth: true,
    })

    // Only omega programmes are seeded, so a programme outside omega has to be made here.
    const addToStudyProgramme = async (userId: number, code: string, partOfOmega: boolean) => {
        const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
        const studyProgramme = await prisma.studyProgramme.upsert({
            where: { code },
            update: {},
            create: {
                name: code,
                code,
                partOfOmega,
                group: { create: { groupType: 'STUDY_PROGRAMME', order } },
            },
            select: { groupId: true },
        })
        await prisma.membership.create({
            data: {
                userId,
                groupId: studyProgramme.groupId,
                order,
                admin: false,
                active: true,
            },
        })
    }

    test('a user on no study programme is part of den gemene hob', async () => {
        const user = await createTestUser('omegainferone')
        expect(await inferLevel(user.id)).toBe('DEN_GEMENE_HOB')
    })

    test('a user on a programme that is part of omega is a soelle', async () => {
        const user = await createTestUser('omegainfertwo')
        await addToStudyProgramme(user.id, 'TESTOMEGA', true)

        expect(await inferLevel(user.id)).toBe('SOELLE')
    })

    test('a user on a programme outside omega is part of den gemene hob', async () => {
        const user = await createTestUser('omegainferthree')
        await addToStudyProgramme(user.id, 'TESTOTHER', false)

        expect(await inferLevel(user.id)).toBe('DEN_GEMENE_HOB')
    })

    test('applying it upgrades den gemene hob but leaves a sysken alone', async () => {
        const user = await createTestUser('omegainferfour')
        await addToStudyProgramme(user.id, 'TESTOMEGA', true)

        const applyInferred = async () => omegaMembershipGroupOperations.updateUserLevel({
            params: {
                userId: user.id,
                omegaMembershipLevel: await inferLevel(user.id),
                onlyUpgrade: true,
            },
            bypassAuth: true,
        })

        await applyInferred()
        expect((await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id }, bypassAuth: true,
        })).level).toBe('SOELLE')

        await setLevel(user.id, 'SYSKEN')
        await applyInferred()

        expect((await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id }, bypassAuth: true,
        })).level).toBe('SYSKEN')
    })
})

describe('updateUserOrder', () => {
    const readOrder = async (userId: number) => (await omegaMembershipGroupOperations.readUserLevel({
        params: { userId }, bypassAuth: true,
    })).order

    const setOrder = (userId: number, order: number) => omegaMembershipGroupOperations.updateUserOrder({
        params: { userId },
        data: { order },
        bypassAuth: true,
    })

    test('moves the active membership to the given order, keeping its level', async () => {
        const user = await createTestUser('omegaorderone')
        await setLevel(user.id, 'SOELLE')
        const { order: current } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })

        await setOrder(user.id, current - 1)

        const membership = await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id }, bypassAuth: true,
        })
        expect(membership.order).toBe(current - 1)
        expect(membership.level).toBe('SOELLE')
        expect(await readOmegaMemberships(user.id)).toHaveLength(1)
    })

    test('leaves a membership already of that order alone', async () => {
        const user = await createTestUser('omegaordertwo')
        const before = await readOrder(user.id)

        await setOrder(user.id, before)

        expect(await readOrder(user.id)).toBe(before)
        expect(await readOmegaMemberships(user.id)).toHaveLength(1)
    })

    test('refuses an order that does not exist', async () => {
        const user = await createTestUser('omegaorderthree')
        const before = await readOrder(user.id)

        await expect(setOrder(user.id, 9999)).rejects.toThrow(Smorekopp)

        expect(await readOrder(user.id)).toBe(before)
    })

    test('collapses onto a membership of the same level already sitting at the target order', async () => {
        const user = await createTestUser('omegaorderfour')
        await setLevel(user.id, 'SOELLE')
        const { order: current } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
        const soelle = await prisma.omegaMembershipGroup.findUniqueOrThrow({
            where: { omegaMembershipLevel: 'SOELLE' },
        })

        // An inactive duplicate of the same membership, an order behind.
        await prisma.membership.create({
            data: {
                userId: user.id,
                groupId: soelle.groupId,
                order: current - 1,
                admin: false,
                active: false,
            },
        })

        await setOrder(user.id, current - 1)

        // The den gemene hob membership the user was created with stays, inactive - what is
        // checked is that the soelle group holds one membership, not two.
        const all = await prisma.membership.findMany({
            where: { userId: user.id, groupId: soelle.groupId },
        })
        expect(all).toHaveLength(1)
        expect(all[0].order).toBe(current - 1)
        expect(all[0].active).toBe(true)
    })
})

describe('updateUserLevel keeps the levels a user has been through', () => {
    const readAllOmegaMemberships = (userId: number) => prisma.membership.findMany({
        where: { userId, group: { groupType: 'OMEGA_MEMBERSHIP_GROUP' } },
        select: {
            order: true,
            active: true,
            group: { select: { omegaMembershipGroup: { select: { omegaMembershipLevel: true } } } },
        },
    })
    const levelOf = (membership: Awaited<ReturnType<typeof readAllOmegaMemberships>>[number]) =>
        membership.group.omegaMembershipGroup?.omegaMembershipLevel

    test('promoting a soelle leaves the soelle membership inactive', async () => {
        const user = await createTestUser('omegahistoryone')
        await setLevel(user.id, 'SOELLE')

        await setLevel(user.id, 'SYSKEN')

        const all = await readAllOmegaMemberships(user.id)
        expect(all.filter(membership => membership.active).map(levelOf)).toEqual(['SYSKEN'])
        expect(all.find(membership => levelOf(membership) === 'SOELLE')?.active).toBe(false)
    })

    test('putting a user back at a level reactivates the membership they held, of its own order', async () => {
        const user = await createTestUser('omegahistorytwo')
        await setLevel(user.id, 'SOELLE')
        const { order: current } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
        await omegaMembershipGroupOperations.updateUserOrder({
            params: { userId: user.id },
            data: { order: current - 1 },
            bypassAuth: true,
        })
        await setLevel(user.id, 'SYSKEN')

        await setLevel(user.id, 'SOELLE')

        const resolved = await omegaMembershipGroupOperations.readUserLevel({
            params: { userId: user.id }, bypassAuth: true,
        })
        expect(resolved).toEqual({ level: 'SOELLE', order: current - 1 })
        const all = await readAllOmegaMemberships(user.id)
        expect(all.filter(membership => levelOf(membership) === 'SOELLE')).toHaveLength(1)
        expect(all.find(membership => levelOf(membership) === 'SYSKEN')?.active).toBe(false)
    })

    test('a user holds at most one membership per level', async () => {
        const user = await createTestUser('omegahistorythree')
        await setLevel(user.id, 'SOELLE')
        await setLevel(user.id, 'SYSKEN')
        await setLevel(user.id, 'SOELLE')
        await setLevel(user.id, 'SYSKEN')

        const all = await readAllOmegaMemberships(user.id)
        const levels = all.map(levelOf)
        expect(new Set(levels).size).toBe(levels.length)
        expect(all.filter(membership => membership.active).map(levelOf)).toEqual(['SYSKEN'])
    })
})
