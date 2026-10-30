import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'
import { beforeAll, describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000

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

/** Every registration of an event, holding a place or on its waiting list. */
const registrationsOf = (eventId: number) => ({ OR: [{ quota: { eventId } }, { waitingListEventId: eventId }] })

async function createTestEvent(name: string, places = 10) {
    return eventOperations.create({
        data: {
            name,
            location: 'Omegakjelleren',
            eventStart: new Date(Date.now() + HOUR),
            eventEnd: new Date(Date.now() + 2 * HOUR),
            canBeViewedBy: 'ALL',
            takesRegistration: true,
            places,
            registrationStart: new Date(Date.now() - HOUR),
            registrationEnd: new Date(Date.now() + HOUR),
            waitingList: true,
            tagIds: [],
            // No conditions is satisfiable by no one, so only EVENT_ADMIN administrates this event.
            visibilityAdminRequirements: [{ conditions: [] }],
        },
        bypassAuth: true,
    })
}

describe('taking attendance for an event', () => {
    let doorSession: ReturnType<typeof Session.fromJsObject>
    let doorUserId: number

    beforeAll(async () => {
        const doorUser = await createTestUser('attendancedoorkeeper')
        doorUserId = doorUser.id
        doorSession = Session.fromJsObject({
            memberships: [],
            permissions: ['EVENT_ADMIN'],
            user: doorUser,
        })
    })

    const registerAttendance = (eventId: number, userId: number) =>
        eventRegistrationOperations.registerAttendance({
            params: { eventId, userId, registeredById: doorUserId },
            session: doorSession,
        })

    const setAttendance = (registrationId: number, attended: boolean) =>
        eventRegistrationOperations.setAttendance({
            params: { registrationId, registeredById: doorUserId },
            data: { attended },
            session: doorSession,
        })

    const register = (eventId: number, userId: number) =>
        eventRegistrationOperations.create({ params: { eventId, userId }, bypassAuth: true })

    test('a scan marks the one registered as having shown up, and records who scanned them', async () => {
        const event = await createTestEvent('Attendance scan event')
        const user = await createTestUser('attendanceone')
        await register(event.id, user.id)

        const scan = await registerAttendance(event.id, user.id)

        expect(scan.alreadyAttended).toBe(false)
        expect(scan.registration.attendedAt).toBeInstanceOf(Date)
        expect(scan.counts).toEqual({ attended: 1, total: 1, attendedFromWaitingList: 0 })

        const stored = await prisma.eventRegistration.findFirstOrThrow({
            where: { userId: user.id, ...registrationsOf(event.id) },
            select: { attendedAt: true, attendanceRegisteredById: true },
        })
        expect(stored.attendedAt).not.toBeNull()
        expect(stored.attendanceRegisteredById).toBe(doorUserId)
    })

    test('a second scan leaves the first one standing and says so', async () => {
        const event = await createTestEvent('Attendance rescan event')
        const user = await createTestUser('attendancetwo')
        await register(event.id, user.id)

        const first = await registerAttendance(event.id, user.id)
        const second = await registerAttendance(event.id, user.id)

        expect(second.alreadyAttended).toBe(true)
        expect(second.registration.attendedAt).toEqual(first.registration.attendedAt)
        expect(second.counts).toEqual({ attended: 1, total: 1, attendedFromWaitingList: 0 })
    })

    test('of two scans at the same time, only one is the first', async () => {
        const event = await createTestEvent('Attendance concurrent scan event')
        const user = await createTestUser('attendanceconcurrent')
        await register(event.id, user.id)

        const scans = await Promise.all([
            registerAttendance(event.id, user.id),
            registerAttendance(event.id, user.id),
        ])

        expect(scans.filter(scan => !scan.alreadyAttended)).toHaveLength(1)
        expect(scans[0].registration.attendedAt).toEqual(scans[1].registration.attendedAt)
    })

    test('scanning someone who is not registered is turned away, and registers nobody', async () => {
        const event = await createTestEvent('Attendance stranger event')
        const stranger = await createTestUser('attendancethree')

        await expect(registerAttendance(event.id, stranger.id)).rejects.toThrow(Smorekopp)

        expect(await prisma.eventRegistration.count({ where: registrationsOf(event.id) })).toBe(0)
    })

    test('a guest with no Omega-ID is marked by hand, and clearing it drops who marked them', async () => {
        const event = await createTestEvent('Attendance guest event')
        const guest = await eventRegistrationOperations.createGuest({
            params: { eventId: event.id },
            data: { name: 'Gjest Gjestesen', note: '' },
            bypassAuth: true,
        })

        const marked = await setAttendance(guest.id, true)
        expect(marked.attendedAt).toBeInstanceOf(Date)

        const cleared = await setAttendance(guest.id, false)
        expect(cleared.attendedAt).toBeNull()

        const stored = await prisma.eventRegistration.findUniqueOrThrow({
            where: { id: guest.id },
            select: { attendanceRegisteredById: true },
        })
        expect(stored.attendanceRegisteredById).toBeNull()
    })

    test('the button in the registration list marks and clears attendance through the form', async () => {
        const event = await createTestEvent('Attendance button event')
        const user = await createTestUser('attendancebutton')
        const registration = await register(event.id, user.id)

        const formWith = (attended: string) => {
            const formData = new FormData()
            formData.append('attended', attended)
            return formData
        }
        const submit = (attended: string) => eventRegistrationOperations.setAttendance({
            params: { registrationId: registration.id, registeredById: doorUserId },
            data: formWith(attended),
            session: doorSession,
        })

        expect((await submit('on')).attendedAt).toBeInstanceOf(Date)
        expect((await submit(FIELD_IS_PRESENT_VALUE)).attendedAt).toBeNull()
    })

    test('marking someone as attended again leaves the scan standing', async () => {
        const event = await createTestEvent('Attendance resave event')
        const user = await createTestUser('attendanceresave')
        const registration = await register(event.id, user.id)

        const scan = await registerAttendance(event.id, user.id)
        const saved = await setAttendance(registration.id, true)

        expect(saved.attendedAt).toEqual(scan.registration.attendedAt)
    })

    test('the tally is against the places of the event, with the waiting list counted apart', async () => {
        const event = await createTestEvent('Attendance counting event', 1)
        const takesThePlace = await createTestUser('attendancefour')
        const onWaitingList = await createTestUser('attendancefive')
        await register(event.id, takesThePlace.id)
        const queued = await register(event.id, onWaitingList.id)

        expect(queued.state).toBe('WAITING_LIST')

        const counts = await eventRegistrationOperations.readAttendanceCounts({
            params: { eventId: event.id },
            session: doorSession,
        })
        expect(counts).toEqual({ attended: 0, total: 1, attendedFromWaitingList: 0 })

        const waitingListScan = await registerAttendance(event.id, onWaitingList.id)
        expect(waitingListScan.counts).toEqual({ attended: 0, total: 1, attendedFromWaitingList: 1 })

        const placeScan = await registerAttendance(event.id, takesThePlace.id)
        expect(placeScan.counts).toEqual({ attended: 1, total: 1, attendedFromWaitingList: 1 })
    })

    test('a session without the admin level of the event may not take attendance', async () => {
        const event = await createTestEvent('Attendance outsider event')
        const user = await createTestUser('attendancesix')
        await register(event.id, user.id)

        const outsider = await createTestUser('attendanceoutsider')
        const outsiderSession = Session.fromJsObject({
            memberships: [],
            permissions: [],
            user: outsider,
        })

        await expect(eventRegistrationOperations.registerAttendance({
            params: { eventId: event.id, userId: user.id, registeredById: outsider.id },
            session: outsiderSession,
        })).rejects.toThrow(Smorekopp)
    })

    test('attendance cannot be recorded as taken by someone other than the one logged in', async () => {
        const event = await createTestEvent('Attendance impersonation event')
        const user = await createTestUser('attendanceseven')
        await register(event.id, user.id)

        await expect(eventRegistrationOperations.registerAttendance({
            params: { eventId: event.id, userId: user.id, registeredById: user.id },
            session: doorSession,
        })).rejects.toThrow(Smorekopp)
    })
})
