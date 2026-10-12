import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { UserFiltered } from '@/services/users/types'

const HOUR = 60 * 60 * 1000

let currentOrder: number
/** The group whose active members may register - the regular level of every test event. */
let membersGroupId: number
/** The group whose members, on top of being members, organise every test event. */
let organisersGroupId: number
/** Gives the dots in the tests. */
let accuser: UserFiltered

async function createManualGroup(shortName: string) {
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: shortName, shortName } },
        },
    })
    return group.id
}

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

function sessionOf(user: UserFiltered, groupIds: number[] = [membersGroupId]) {
    const memberships: MembershipFiltered[] = groupIds.map(groupId => ({
        groupId,
        order: currentOrder,
        active: true,
        admin: false,
    }))
    return Session.fromJsObject({ user, permissions: [], memberships })
}

const organiserSessionOf = (user: UserFiltered) => sessionOf(user, [membersGroupId, organisersGroupId])

async function createEvent({
    places,
    waitingList,
    registrationStart = new Date(Date.now() - HOUR),
    registrationEnd = new Date(Date.now() + 24 * HOUR),
}: {
    places: number,
    waitingList: boolean,
    registrationStart?: Date,
    registrationEnd?: Date,
}) {
    const event = await eventOperations.create({
        data: {
            name: 'Testarrangement',
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 7 * 24 * HOUR),
            eventEnd: new Date(Date.now() + 7 * 24 * HOUR + 2 * HOUR),
            canBeViewdBy: 'ALL',
            takesRegistration: true,
            places,
            waitingList,
            registrationStart,
            registrationEnd,
            tagIds: [],
            visibilityRegularRequirements: [
                { conditions: [{ type: 'ACTIVE', groupId: membersGroupId }] },
            ],
            visibilityAdminRequirements: [
                { conditions: [{ type: 'ACTIVE', groupId: membersGroupId }] },
                { conditions: [{ type: 'ACTIVE', groupId: organisersGroupId }] },
            ],
        },
        bypassAuth: true,
    })
    return event.id
}

const register = (user: UserFiltered, eventId: number, session = sessionOf(user)) =>
    eventRegistrationOperations.create({
        params: { userId: user.id, eventId },
        session,
    })

const unregister = (registrationId: number, session: ReturnType<typeof sessionOf>) =>
    eventRegistrationOperations.destroy({
        params: { registrationId },
        session,
    })

const readOfUser = (user: UserFiltered, eventId: number) => eventRegistrationOperations.readOfUser({
    params: { eventId, userId: user.id },
    bypassAuth: true,
})

const countRegistrations = (eventId: number, user?: UserFiltered) => prisma.eventRegistration.count({
    where: { eventId, userId: user?.id },
})

beforeAll(async () => {
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    membersGroupId = await createManualGroup('registration-members')
    organisersGroupId = await createManualGroup('registration-organisers')
    accuser = await createTestUser('registrationaccuser')
})

describe('registering for an event', () => {
    test('registrations within the places of the event take a place', async () => {
        const eventId = await createEvent({ places: 2, waitingList: true })
        const user = await createTestUser('registerplaceone')

        const registration = await register(user, eventId)

        expect(registration.onWaitingList).toBe(false)
        expect(await readOfUser(user, eventId)).toMatchObject({ id: registration.id, onWaitingList: false })
    })

    test('once every place is taken, registrations queue on the waiting list', async () => {
        const eventId = await createEvent({ places: 1, waitingList: true })
        const first = await createTestUser('registerqueueone')
        const second = await createTestUser('registerqueuetwo')

        expect((await register(first, eventId)).onWaitingList).toBe(false)
        expect((await register(second, eventId)).onWaitingList).toBe(true)

        expect(await readOfUser(first, eventId)).toMatchObject({ onWaitingList: false })
        expect(await readOfUser(second, eventId)).toMatchObject({ onWaitingList: true })
    })

    test('an event without a waiting list refuses registrations once full', async () => {
        const eventId = await createEvent({ places: 1, waitingList: false })
        const first = await createTestUser('registerfullone')
        const second = await createTestUser('registerfulltwo')

        await register(first, eventId)

        await expect(register(second, eventId)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await countRegistrations(eventId)).toBe(1)
        expect(await readOfUser(second, eventId)).toBeNull()
    })

    test('a user cannot register twice', async () => {
        const eventId = await createEvent({ places: 5, waitingList: true })
        const user = await createTestUser('registertwice')

        await register(user, eventId)

        await expect(register(user, eventId)).rejects.toThrow(new Smorekopp('DUPLICATE'))
        expect(await countRegistrations(eventId, user)).toBe(1)
    })

    test('a user cannot register someone else', async () => {
        const eventId = await createEvent({ places: 5, waitingList: true })
        const user = await createTestUser('registerother')
        const other = await createTestUser('registerotherby')

        await expect(register(user, eventId, sessionOf(other))).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(register(user, eventId, Session.empty())).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
        expect(await countRegistrations(eventId)).toBe(0)
    })

    test('a user outside the regular level of the event cannot register', async () => {
        const eventId = await createEvent({ places: 5, waitingList: true })
        const outsider = await createTestUser('registeroutsider')

        await expect(register(outsider, eventId, sessionOf(outsider, [])))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        expect(await countRegistrations(eventId)).toBe(0)
    })

    test('registration is closed before it opens and after it has ended', async () => {
        const notOpenYet = await createEvent({
            places: 5,
            waitingList: true,
            registrationStart: new Date(Date.now() + HOUR),
            registrationEnd: new Date(Date.now() + 2 * HOUR),
        })
        const ended = await createEvent({
            places: 5,
            waitingList: true,
            registrationStart: new Date(Date.now() - 2 * HOUR),
            registrationEnd: new Date(Date.now() - HOUR),
        })
        const user = await createTestUser('registerclosed')

        await expect(register(user, notOpenYet)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        await expect(register(user, ended)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await countRegistrations(notOpenYet)).toBe(0)
        expect(await countRegistrations(ended)).toBe(0)
    })

    test('an organiser of the event may register someone outside the registration period', async () => {
        const eventId = await createEvent({
            places: 5,
            waitingList: true,
            registrationStart: new Date(Date.now() - 2 * HOUR),
            registrationEnd: new Date(Date.now() - HOUR),
        })
        const user = await createTestUser('registerbyorganiser')
        const organiser = await createTestUser('registerorganiser')

        await register(user, eventId, organiserSessionOf(organiser))

        expect(await countRegistrations(eventId, user)).toBe(1)
    })
})

describe('dots when registering', () => {
    const giveDots = (user: UserFiltered, value: number) => prisma.dot.create({
        data: { userId: user.id, accuserId: accuser.id, value, reason: 'Møtte ikke opp' },
    })

    test('a user with five active dots may not register at all', async () => {
        const eventId = await createEvent({ places: 5, waitingList: true })
        const user = await createTestUser('registerbanned')
        await giveDots(user, 5)

        await expect(register(user, eventId)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await countRegistrations(eventId)).toBe(0)
    })

    test('a user with two dots must wait ten minutes past the registration start', async () => {
        const justOpened = await createEvent({
            places: 5,
            waitingList: true,
            registrationStart: new Date(Date.now() - 60 * 1000),
        })
        const openedAnHourAgo = await createEvent({ places: 5, waitingList: true })
        const user = await createTestUser('registertimeout')
        await giveDots(user, 2)

        await expect(register(user, justOpened)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await countRegistrations(justOpened)).toBe(0)

        await register(user, openedAnHourAgo)
        expect(await countRegistrations(openedAnHourAgo, user)).toBe(1)
    })
})

describe('unregistering from an event', () => {
    test('when someone with a place unregisters, the first on the waiting list takes it', async () => {
        const eventId = await createEvent({ places: 1, waitingList: true })
        const first = await createTestUser('unregisterpromoteone')
        const second = await createTestUser('unregisterpromotetwo')
        const third = await createTestUser('unregisterpromotethree')

        const firstRegistration = await register(first, eventId)
        await register(second, eventId)
        await register(third, eventId)

        await unregister(firstRegistration.id, sessionOf(first))

        expect(await readOfUser(first, eventId)).toBeNull()
        expect(await readOfUser(second, eventId)).toMatchObject({ onWaitingList: false })
        expect(await readOfUser(third, eventId)).toMatchObject({ onWaitingList: true })
    })

    test('leaving the waiting list leaves the places as they are', async () => {
        const eventId = await createEvent({ places: 1, waitingList: true })
        const first = await createTestUser('unregisterwaitingone')
        const second = await createTestUser('unregisterwaitingtwo')
        const third = await createTestUser('unregisterwaitingthree')

        await register(first, eventId)
        const secondRegistration = await register(second, eventId)
        await register(third, eventId)

        await unregister(secondRegistration.id, sessionOf(second))

        expect(await readOfUser(first, eventId)).toMatchObject({ onWaitingList: false })
        expect(await readOfUser(second, eventId)).toBeNull()
        expect(await readOfUser(third, eventId)).toMatchObject({ onWaitingList: true })
    })

    test('a user cannot unregister someone else', async () => {
        const eventId = await createEvent({ places: 5, waitingList: true })
        const user = await createTestUser('unregisterother')
        const other = await createTestUser('unregisterotherby')

        const registration = await register(user, eventId)

        await expect(unregister(registration.id, sessionOf(other))).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        expect(await countRegistrations(eventId, user)).toBe(1)
    })

    test('a user cannot unregister after the registration has ended, but an organiser can', async () => {
        const eventId = await createEvent({ places: 5, waitingList: true })
        const user = await createTestUser('unregisterlate')
        const organiser = await createTestUser('unregisterlateorganiser')

        const registration = await register(user, eventId)
        await prisma.event.update({
            where: { id: eventId },
            data: { registrationEnd: new Date(Date.now() - 60 * 1000) },
        })

        await expect(unregister(registration.id, sessionOf(user))).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await countRegistrations(eventId, user)).toBe(1)

        await unregister(registration.id, organiserSessionOf(organiser))
        expect(await countRegistrations(eventId, user)).toBe(0)
    })
})
