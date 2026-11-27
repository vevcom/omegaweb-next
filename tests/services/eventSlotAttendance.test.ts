import { testSession } from 'tests/utils'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const time = {
    eventStart: new Date(Math.floor(Date.now() / HOUR) * HOUR - HOUR),
    eventEnd: new Date(Math.floor(Date.now() / HOUR) * HOUR + 2 * HOUR),
}

const refusedWith = (message: string) => ({ errors: [expect.objectContaining({ message })] })

let userIds: number[]
let doorSession: ReturnType<typeof Session.fromJsObject>
let doorUserId: number

beforeAll(async () => {
    const users = await Promise.all(Array.from({ length: 4 }, (_, index) => userOperations.create({
        data: {
            email: `slot-attendance-${index}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: `Testesen ${index}`,
            username: `slot-attendance-${index}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    userIds = users.map(user => user.id)
    doorUserId = userIds[3]
    doorSession = Session.fromJsObject({ memberships: [], permissions: ['EVENT_ADMIN'], user: users[3] })
})

/** An event with a slotted variant of three slots, the first held by a user and the third by a guest. */
async function createSlottedEvent(name: string) {
    const event = await eventOperations.create({
        data: {
            kind: 'ORDINARY',
            name,
            location: 'Lophtet',
            ...time,
            visibilityAdminRequirements: [{ conditions: [] }],
        },
        bypassAuth: true,
    })
    await eventOperations.saveSetup({
        params: { id: event.id },
        data: {
            variants: [{
                name: 'Påmelding',
                registrationType: 'SLOTTED',
                registrationStart: new Date(Date.now() - 2 * HOUR),
                registrationEnd: time.eventStart,
                takesPayment: false,
                slotSchedule: {
                    start: time.eventStart,
                    slotMinutes: 10,
                    breakMinutes: 5,
                    totalMinutes: 40,
                    longBreakEveryMinutes: null,
                    longBreakMinutes: null,
                },
                quotas: [{ name: 'Alle', places: 3, visibilityRequirements: [] }],
            }],
        },
        bypassAuth: true,
    })
    const variant = await prisma.eventVariant.findFirstOrThrow({
        where: { eventId: event.id },
        include: { slots: { orderBy: { start: 'asc' } } },
    })
    const user = await eventRegistrationOperations.createAsAdmin({
        params: { eventId: event.id, userId: userIds[0], slotId: variant.slots[0].id },
        bypassAuth: true,
    })
    const guest = await eventRegistrationOperations.createGuest({
        params: { eventId: event.id, slotId: variant.slots[2].id },
        data: { name: 'Gjest', note: '' },
        bypassAuth: true,
    })
    return { eventId: event.id, variantId: variant.id, slots: variant.slots, user, guest }
}

const readSlotAttendance = (variantId: number) => eventRegistrationOperations.readSlotAttendance({
    params: { variantId },
    session: doorSession,
})

const setFinished = (variantId: number, finished: boolean) => eventRegistrationOperations.setAttendanceFinished({
    params: { variantId },
    data: { finished },
    session: doorSession,
})

describe('attendance on a slotted variant', () => {
    test('is read slot by slot in order, with who holds each and whether they came', async () => {
        const { eventId, variantId, slots, user, guest } = await createSlottedEvent('Oppmøte per tidsluke')
        await eventRegistrationOperations.registerAttendance({
            params: { eventId, userId: userIds[0], registeredById: doorUserId },
            session: doorSession,
        })

        const attendance = await readSlotAttendance(variantId)

        expect(attendance.finishedAt).toBeNull()
        expect(attendance.slots.map(slot => slot.start)).toEqual(slots.map(slot => slot.start))
        expect(attendance.slots.map(slot => slot.registration?.id ?? null)).toEqual([user.id, null, guest.id])
        expect(attendance.slots[0].registration?.attendedAt).toBeInstanceOf(Date)
        expect(attendance.slots[2].registration).toMatchObject({ attendedAt: null, contact: { name: 'Gjest' } })
    })

    test('is finished, which gives no dots and leaves one not marked as not having come, and opened again', async () => {
        const { eventId, variantId, guest } = await createSlottedEvent('Fullført oppmøte')
        await eventRegistrationOperations.registerAttendance({
            params: { eventId, userId: userIds[0], registeredById: doorUserId },
            session: doorSession,
        })
        const dots = await prisma.dot.count()

        await setFinished(variantId, true)
        const { finishedAt } = await readSlotAttendance(variantId)
        expect(finishedAt).toBeInstanceOf(Date)
        await setFinished(variantId, true)
        expect((await readSlotAttendance(variantId)).finishedAt).toEqual(finishedAt)

        expect(await prisma.dot.count()).toBe(dots)
        expect(await eventRegistrationOperations.readAttendanceCounts({ params: { eventId }, session: doorSession }))
            .toEqual({ attended: 1, total: 2, attendedFromWaitingList: 0 })

        // Still marked by hand once finished, as a correction.
        await eventRegistrationOperations.setAttendance({
            params: { registrationId: guest.id, registeredById: doorUserId },
            data: { attended: true },
            session: doorSession,
        })
        expect((await readSlotAttendance(variantId)).slots[2].registration?.attendedAt).toBeInstanceOf(Date)

        await setFinished(variantId, false)
        expect((await readSlotAttendance(variantId)).finishedAt).toBeNull()
    })

    test('is read and finished only by those who administrate the event', async () => {
        const { eventId, variantId } = await createSlottedEvent('Ikke arrangør av oppmøtet')
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userIds[0] } })
        // Published and open to all, so the registrant sees it and is refused only for not administrating it.
        await prisma.event.update({ where: { id: eventId }, data: { published: true, canBeViewedBy: 'ALL' } })
        const session = testSession({ user: user as never })

        await expect(eventRegistrationOperations.readSlotAttendance({ params: { variantId }, session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(eventRegistrationOperations.setAttendanceFinished({
            params: { variantId },
            data: { finished: true },
            session,
        })).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        expect((await readSlotAttendance(variantId)).finishedAt).toBeNull()
    })
})

describe('finishing attendance', () => {
    test('writes nothing to a variant that became a list after its type was read', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'Ble en liste',
                location: 'Lophtet',
                ...time,
                takesRegistration: true,
                places: 2,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        const variant = await prisma.eventVariant.findFirstOrThrow({ where: { eventId: event.id } })
        // A client whose read of the type comes from before the variant was made a list.
        const readBefore = new Proxy(prisma, {
            get: (client, property): unknown => (property === 'eventVariant'
                ? new Proxy(client.eventVariant, {
                    get: (variants, method): unknown => (method === 'findUniqueOrThrow'
                        ? () => Promise.resolve({ registrationType: 'SLOTTED' })
                        : Reflect.get(variants, method)),
                })
                : Reflect.get(client, property)),
        })

        await eventRegistrationOperations.setAttendanceFinished({
            params: { variantId: variant.id },
            data: { finished: true },
            prisma: readBefore,
            bypassAuth: true,
        })

        const after = await prisma.eventVariant.findUniqueOrThrow({ where: { id: variant.id } })
        expect(after.attendanceFinishedAt).toBeNull()
    })
})

describe('attendance on a list variant', () => {
    test('is taken as before, has no slots and is not finished', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'Oppmøte på liste',
                location: 'Lophtet',
                ...time,
                takesRegistration: true,
                places: 2,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        const variant = await prisma.eventVariant.findFirstOrThrow({ where: { eventId: event.id } })
        await eventRegistrationOperations.createAsAdmin({
            params: { eventId: event.id, userId: userIds[1] },
            bypassAuth: true,
        })

        const scan = await eventRegistrationOperations.registerAttendance({
            params: { eventId: event.id, userId: userIds[1], registeredById: doorUserId },
            session: doorSession,
        })

        expect(scan).toMatchObject({ alreadyAttended: false, counts: { attended: 1, total: 1 } })
        expect(await readSlotAttendance(variant.id)).toEqual({ finishedAt: null, slots: [] })
        await expect(setFinished(variant.id, true))
            .rejects.toMatchObject(refusedWith('Bare oppmøtet til en variant med tidsluker fullføres.'))
        expect((await prisma.eventVariant.findUniqueOrThrow({ where: { id: variant.id } })).attendanceFinishedAt)
            .toBeNull()
    })
})
