import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { userOperations } from '@/services/users/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { REGISTRATION_READER_TYPE } from '@/services/events/registration/constants'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

const privateFields = ['mobile', 'allergies', 'studentCard', 'imageConsent', 'acceptedTerms', 'emailVerified'] as const

let target: UserFiltered
let viewer: UserFiltered
let eventId: number

function sessionOf(user: UserFiltered | null, permissions: Permission[]) {
    return Session.fromJsObject({ memberships: [], permissions, user })
}

function expectNoPrivateFields(user: object | null) {
    expect(user).not.toBeNull()
    privateFields.forEach(field => expect(user).not.toHaveProperty(field))
}

const firstPage = { pageSize: 10, page: 0, cursor: null } as const

beforeAll(async () => {
    target = await prisma.user.create({
        data: {
            username: 'exposure-target',
            email: 'exposure-target@omega.ntnu.no',
            firstname: 'Target',
            lastname: 'Exposed',
            mobile: '12345678',
            allergies: 'peanuts',
            studentCard: 'exposure-card',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
    viewer = await prisma.user.create({
        data: {
            username: 'exposure-viewer',
            email: 'exposure-viewer@omega.ntnu.no',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })

    const event = await prisma.event.create({
        data: {
            name: 'Exposure test',
            paragraph: { create: {} },
            coverImage: { create: {} },
            eventStart: new Date(),
            eventEnd: new Date(),
            canBeViewdBy: 'ALL',
            takesRegistration: true,
            places: 10,
            registrationStart: new Date(),
            registrationEnd: new Date(),
            waitingList: false,
            visibilityAdmin: { create: { requirements: { create: [{}] } } },
            visibilityRegular: { create: {} },
            eventRegistrations: { create: [{ userId: target.id }] },
        },
    })
    eventId = event.id
})

afterAll(async () => {
    await prisma.eventRegistration.deleteMany({ where: { eventId } })
    await prisma.event.delete({ where: { id: eventId } })
    await prisma.user.deleteMany({ where: { username: { in: ['exposure-target', 'exposure-viewer'] } } })
})

describe('users', () => {
    test('a member with USERS_USE reads another profile without the private fields', async () => {
        const profile = await userOperations.readProfile({
            params: { username: target.username },
            session: sessionOf(viewer, ['USERS_USE']),
        })
        expectNoPrivateFields(profile.user)
        expect(profile.user.email).toBe(target.email)
    })

    test('a profile carries no private fields, not even for the user themselves', async () => {
        const profile = await userOperations.readProfile({
            params: { username: target.username },
            session: sessionOf(target, []),
        })
        expectNoPrivateFields(profile.user)
    })

    test('the user themselves and USERS_ADMIN read the private fields', async () => {
        const sessions = [sessionOf(target, []), sessionOf(viewer, ['USERS_USE', 'USERS_ADMIN'])]
        const users = await Promise.all(sessions.map(session => userOperations.read({
            params: { id: target.id },
            session,
        })))
        users.forEach(user => {
            expect(user.allergies).toBe('peanuts')
            expect(user.studentCard).toBe('exposure-card')
        })
    })

    test('USERS_USE is not enough to read another user in full', async () => {
        await expect(userOperations.read({
            params: { id: target.id },
            session: sessionOf(viewer, ['USERS_USE']),
        })).rejects.toThrow(Smorekopp)
        await expect(userOperations.read({
            params: { studentCard: 'exposure-card' },
            session: sessionOf(viewer, ['USERS_USE']),
        })).rejects.toThrow(Smorekopp)
    })

    test('a balance is only for the user themselves and LEDGER_ADMIN', async () => {
        await expect(userOperations.readUserWithBalance({
            params: { studentCard: 'exposure-card' },
            session: sessionOf(viewer, ['USERS_USE']),
        })).rejects.toThrow(Smorekopp)

        const ownLookups = [
            { username: target.username },
            { id: target.id },
            { email: target.email },
            { studentCard: 'exposure-card' },
        ]
        const results = await Promise.all([
            ...ownLookups.map(params => userOperations.readUserWithBalance({
                params,
                session: sessionOf(target, []),
            })),
            userOperations.readUserWithBalance({
                params: { studentCard: 'exposure-card' },
                session: sessionOf(viewer, ['LEDGER_ADMIN']),
            }),
        ])
        results.forEach(result => expect(result.user.id).toBe(target.id))
    })

    test('USERS_USE reads the basic fields of another user', async () => {
        const user = await userOperations.readBasic({
            params: { id: target.id },
            session: sessionOf(viewer, ['USERS_USE']),
        })
        expect(user).toEqual({
            id: target.id,
            username: target.username,
            firstname: target.firstname,
            lastname: target.lastname,
        })
    })

    test('a page of users carries no private or contact fields', async () => {
        const users = await userOperations.readPage({
            params: { paging: { page: firstPage, details: { partOfName: 'exposure-target', groups: [] } } },
            session: sessionOf(viewer, ['USERS_USE']),
        })
        expect(users).toHaveLength(1)
        expectNoPrivateFields(users[0])
        expect(users[0]).not.toHaveProperty('email')
        expect(users[0]).not.toHaveProperty('mobile')
    })
})

describe('event registrations', () => {
    const details = () => ({ eventId, type: REGISTRATION_READER_TYPE.REGISTRATIONS })

    test('a visitor who is not logged in cannot read who is registered', async () => {
        await expect(eventRegistrationOperations.readPage({
            params: { paging: { page: firstPage, details: details() } },
            session: sessionOf(null, []),
        })).rejects.toThrow(Smorekopp)
    })

    test('the registration list shows only the card of each user', async () => {
        const registrations = await eventRegistrationOperations.readPage({
            params: { paging: { page: firstPage, details: details() } },
            session: sessionOf(viewer, []),
        })
        expect(registrations).toHaveLength(1)
        expectNoPrivateFields(registrations[0].user)
        expect(registrations[0].user).not.toHaveProperty('email')
    })

    test('the detailed list gives event admins email, mobile, allergies and attendance', async () => {
        const registrations = await eventRegistrationOperations.readPageDetailed({
            params: { paging: { page: firstPage, details: details() } },
            session: sessionOf(viewer, ['EVENT_ADMIN']),
        })
        expect(registrations[0].user?.email).toBe(target.email)
        expect(registrations[0].user?.mobile).toBe('12345678')
        expect(registrations[0].user?.allergies).toBe('peanuts')
        expect(registrations[0].user).not.toHaveProperty('studentCard')
        // The attendance column of the detailed table reads this off the row itself.
        expect(registrations[0]).toHaveProperty('attendedAt')
    })
})
