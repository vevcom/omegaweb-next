import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { applicationOperations } from '@/services/applications/operations'
import { applicationPeriodOperations } from '@/services/applications/periods/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

const day = 24 * 60 * 60 * 1000
const periodName = 'applications-test-period'

let user: UserFiltered
let periodId: number
let participationOf: Record<'a' | 'b', number>
let committeeIds: number[]

const sessionOf = (permissions: Permission[]) => Session.fromJsObject({ memberships: [], permissions, user })

async function createCommittee(shortName: string) {
    const latestOrder = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    return prisma.committee.create({
        data: {
            name: shortName,
            shortName,
            group: { create: { groupType: 'COMMITTEE', order: latestOrder.order } },
            committeeArticle: { create: { name: shortName, coverImage: { create: {} } } },
            paragraph: { create: {} },
            applicationParagraph: { create: {} },
        },
        select: { id: true },
    })
}

/** The user's applications in the period, by committee participation, in priority order. */
async function priorities() {
    const applications = await applicationOperations.readForUser({
        params: { userId: user.id, periodId },
        session: sessionOf([]),
    })
    return applications
        .sort((one, other) => one.priority - other.priority)
        .map(application => [application.applicationPeriodCommiteeId, application.priority])
}

const apply = (participationId: number) => applicationOperations.create({
    params: { userId: user.id, committeeParticipationId: participationId },
    data: { text: 'Jeg vil være med' },
    session: sessionOf([]),
})

const move = (participationId: number, priority: 'UP' | 'DOWN') => applicationOperations.update({
    params: { userId: user.id, committeeParticipationId: participationId },
    data: { priority },
    session: sessionOf([]),
})

beforeAll(async () => {
    user = await prisma.user.create({
        data: {
            username: 'applications-test',
            email: 'applications-test@omega.ntnu.no',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
    const [committeeA, committeeB] = await Promise.all([
        createCommittee('applications-test-a'),
        createCommittee('applications-test-b'),
    ])
    committeeIds = [committeeA.id, committeeB.id]

    const period = await prisma.applicationPeriod.create({
        data: {
            name: periodName,
            startDate: new Date(Date.now() - day),
            endDate: new Date(Date.now() + day),
            endPriorityDate: new Date(Date.now() + 2 * day),
            committeesParticipating: { create: [{ committeeId: committeeA.id }, { committeeId: committeeB.id }] },
        },
        include: { committeesParticipating: true },
    })
    periodId = period.id
    const participationFor = (committeeId: number) => period.committeesParticipating
        .find(participation => participation.committeeId === committeeId)!.id
    participationOf = { a: participationFor(committeeA.id), b: participationFor(committeeB.id) }
})

afterAll(async () => {
    await prisma.applicationPeriod.deleteMany({ where: { name: periodName } })
    await prisma.committee.deleteMany({ where: { id: { in: committeeIds } } })
    await prisma.user.deleteMany({ where: { username: 'applications-test' } })
})

describe('applications', () => {
    test('an application takes the next priority, and swaps places with its neighbour', async () => {
        await apply(participationOf.a)
        await apply(participationOf.b)
        expect(await priorities()).toEqual([[participationOf.a, 1], [participationOf.b, 2]])

        await move(participationOf.b, 'UP')
        expect(await priorities()).toEqual([[participationOf.b, 1], [participationOf.a, 2]])

        await expect(move(participationOf.b, 'UP')).rejects.toThrow(Smorekopp)
        await expect(move(participationOf.a, 'DOWN')).rejects.toThrow(Smorekopp)
        expect(await priorities()).toEqual([[participationOf.b, 1], [participationOf.a, 2]])
    })

    test('deleting an application closes the gap behind it', async () => {
        await applicationOperations.destroy({
            params: { userId: user.id, committeeParticipationId: participationOf.b },
            session: sessionOf([]),
        })
        expect(await priorities()).toEqual([[participationOf.a, 1]])
    })

    test('a committee leaving the period takes its applications with it, and the rest close ranks', async () => {
        await apply(participationOf.b)
        expect(await priorities()).toEqual([[participationOf.a, 1], [participationOf.b, 2]])

        await applicationPeriodOperations.update({
            params: { name: periodName },
            data: { participatingCommitteeIds: [committeeIds[1]] },
            session: sessionOf(['APPLICATION_ADMIN']),
        })
        expect(await priorities()).toEqual([[participationOf.b, 1]])
        expect(await prisma.committeeParticipationInApplicationPeriod.count({
            where: { applicationPeriodId: periodId },
        })).toBe(1)
    })

    test('the dates of a period stay in order through a partial update', async () => {
        const update = (data: { startDate?: Date, endPriorityDate?: Date }) => applicationPeriodOperations.update({
            params: { name: periodName },
            data,
            session: sessionOf(['APPLICATION_ADMIN']),
        })
        await expect(update({ startDate: new Date(Date.now() + 3 * day) })).rejects.toThrow(Smorekopp)
        await expect(update({ endPriorityDate: new Date() })).rejects.toThrow(Smorekopp)
        await expect(update({ endPriorityDate: new Date(Date.now() + 3 * day) })).resolves.toEqual({ name: periodName })
    })
})
