import { createAdministrators } from 'tests/eventSetup'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { companySessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { eventSlotOperations } from '@/services/events/slots/operations'
import { toVariantDrafts, variantsToPost, withPlacesOfSlots } from '@/services/events/setupDraft'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { EventKind } from '@/prisma-generated-pn-types'
import type { SlotSchedule } from '@/services/events/slots/types'
import type { VisibilityRequirement } from '@/services/visibility/types'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const time = {
    eventStart: new Date(Math.floor(Date.now() / HOUR) * HOUR + 48 * HOUR),
    eventEnd: new Date(Math.floor(Date.now() / HOUR) * HOUR + 51 * HOUR),
}
const at = (minutes: number) => new Date(time.eventStart.getTime() + minutes * MINUTE)

/** Slots of ten minutes, five apart, from the given start. */
const scheduleOf = (slotCount: number, start = time.eventStart): SlotSchedule => ({
    start,
    slotMinutes: 10,
    breakMinutes: 5,
    totalMinutes: 15 * slotCount - 5,
    longBreakEveryMinutes: null,
    longBreakMinutes: null,
})

let administrators: VisibilityRequirement[]
let students: { id: number, email: string }[]
let order: number

async function createStudent(index: number) {
    return await userOperations.create({
        data: {
            email: `company-schedule-${index}@example.com`,
            firstname: 'Student',
            lastname: `Nummer ${index}`,
            username: `company-schedule-${index}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
}

async function joinGroup(userId: number, groupId: number, active = true) {
    await prisma.membership.create({ data: { userId, groupId, order, admin: false, active } })
}

beforeAll(async () => {
    administrators = await createAdministrators('company-schedule-admins')
    order = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    students = await Promise.all(Array.from({ length: 6 }, (_, index) => createStudent(index)))
    await prisma.user.updateMany({
        where: { id: { in: students.map(student => student.id) } },
        data: { mobile: '99999999', allergies: 'Nøtter' },
    })

    const classOf = async (level: 'TWO' | 'FOUR') => (await prisma.class.findUnique({ where: { level } }))?.groupId
        ?? (await prisma.class.create({ data: { level, group: { create: { groupType: 'CLASS', order } } } })).groupId
    const programme = async (code: string) => (await prisma.studyProgramme.upsert({
        where: { code },
        update: {},
        create: { name: `Programmet ${code}`, code, group: { create: { groupType: 'STUDY_PROGRAMME', order } } },
    })).groupId
    await joinGroup(students[0].id, await classOf('TWO'), false)
    await joinGroup(students[0].id, await classOf('FOUR'))
    await joinGroup(students[0].id, await programme('CS-FYS'))
    await joinGroup(students[0].id, await programme('CS-MAT'))
    await joinGroup(students[0].id, await programme('CS-OLD'), false)
})

const createCompany = (name: string) => prisma.company.create({ data: { name, description: '' } })

async function sessionOfCompanyUser(companyId: number, email: string) {
    const companyUser = await prisma.companyUser.create({
        data: {
            companyId,
            email,
            firstname: 'Kari',
            lastname: 'Nordmann',
            credentials: { create: { passwordHash: 'not a hash anyone can match' } },
        },
    })
    return Session.fromToken(await companySessionTokenOf(companyUser.id))
}

/** An event of the company with slotted variants of the given number of slots, published unless asked not to be. */
async function createEvent(name: string, companyId: number, {
    kind = 'SPEED_INTERVIEW',
    slotsPerVariant = [3],
    published = true,
}: { kind?: EventKind, slotsPerVariant?: number[], published?: boolean } = {}) {
    const event = await eventOperations.create({
        data: { kind, name, location: 'Lophtet', ...time, companyId, visibilityAdminRequirements: administrators },
        bypassAuth: true,
    })
    await eventOperations.saveSetup({
        params: { id: event.id },
        data: {
            waitingList: true,
            variants: slotsPerVariant.map((slots, index) => ({
                name: `Runde ${index + 1}`,
                registrationType: 'SLOTTED' as const,
                registrationStart: new Date(Date.now() - HOUR),
                registrationEnd: new Date(Date.now() + 24 * HOUR),
                takesPayment: false,
                slotSchedule: scheduleOf(slots, at(60 * index)),
                quotas: [{ name: 'Alle', places: slots, visibilityRequirements: [] }],
            })),
        },
        bypassAuth: true,
    })
    if (published) {
        await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    }
    const variants = await prisma.eventVariant.findMany({
        where: { eventId: event.id },
        orderBy: { id: 'asc' },
        include: { slots: { orderBy: { start: 'asc' } } },
    })
    return { eventId: event.id, variants }
}

const register = (eventId: number, userId: number, slotId?: number, variantId?: number) => (
    eventRegistrationOperations.createAsAdmin({ params: { eventId, userId, slotId, variantId }, bypassAuth: true })
)

const readSchedule = (variantId: number, session: SessionMaybeUser) => eventSlotOperations.readCompanySchedule({
    params: { variantId },
    session,
})

const free = ({ id, start, end }: { id: number, start: Date, end: Date }) => ({ id, start, end, holder: null })

describe('the schedule a company sees of its speed interview', () => {
    test('is each slot in order with exactly the name, e-mail, class and study programmes of who holds it', async () => {
        const company = await createCompany('Timeplan AS')
        const session = await sessionOfCompanyUser(company.id, 'timeplan@example.com')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju med timeplan', company.id)
        const [first, second, third] = variant.slots
        await register(eventId, students[0].id, third.id)
        await register(eventId, students[1].id, first.id)

        expect(await readSchedule(variant.id, session)).toEqual({
            slots: [
                {
                    id: first.id,
                    start: first.start,
                    end: first.end,
                    holder: { name: 'Student Nummer 1', email: students[1].email, class: null, studyProgrammes: [] },
                },
                free(second),
                {
                    id: third.id,
                    start: third.start,
                    end: third.end,
                    holder: {
                        name: 'Student Nummer 0',
                        email: students[0].email,
                        class: 'FOUR',
                        studyProgrammes: ['Programmet CS-FYS', 'Programmet CS-MAT'],
                    },
                },
            ],
            waiting: 0,
        })
    })

    test('gives the latest of several active classes, and a programme of several orders once', async () => {
        const company = await createCompany('Klasser AS')
        const session = await sessionOfCompanyUser(company.id, 'klasser@example.com')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju med klasser', company.id)
        const student = await createStudent(6)
        const earlier = order - 1
        await prisma.omegaOrder.upsert({ where: { order: earlier }, update: {}, create: { order: earlier } })
        const classes = await prisma.class.findMany({
            where: { level: { in: ['ONE', 'THREE'] } },
            orderBy: { groupId: 'asc' },
        })
        const created = await Promise.all((['ONE', 'THREE'] as const)
            .filter(level => !classes.some(found => found.level === level))
            .map(level => prisma.class.create({ data: { level, group: { create: { groupType: 'CLASS', order } } } })))
        // The earlier class has the lower group and is joined first, so neither the order of the rows
        // nor the order of the groups gives the latest by chance.
        const [older, latest] = [...classes, ...created].sort((first, second) => first.groupId - second.groupId)
        await prisma.membership.create({
            data: { userId: student.id, groupId: older.groupId, order: earlier, admin: false, active: true },
        })
        await joinGroup(student.id, latest.groupId)
        const programme = (await prisma.studyProgramme.upsert({
            where: { code: 'CS-TO' },
            update: {},
            create: {
                name: 'Programmet CS-TO',
                code: 'CS-TO',
                group: { create: { groupType: 'STUDY_PROGRAMME', order } },
            },
        })).groupId
        await prisma.membership.create({
            data: { userId: student.id, groupId: programme, order: earlier, admin: false, active: true },
        })
        await joinGroup(student.id, programme)
        await register(eventId, student.id, variant.slots[0].id)

        expect((await readSchedule(variant.id, session)).slots[0].holder).toMatchObject({
            class: latest.level,
            studyProgrammes: ['Programmet CS-TO'],
        })
    })

    test('gives the waiting list as a number', async () => {
        const company = await createCompany('Venteliste AS')
        const session = await sessionOfCompanyUser(company.id, 'venteliste@example.com')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju med venteliste', company.id, {
            slotsPerVariant: [1],
        })
        await register(eventId, students[0].id, variant.slots[0].id)
        await register(eventId, students[1].id)
        await register(eventId, students[2].id)

        const schedule = await readSchedule(variant.id, session)
        expect(schedule.waiting).toBe(2)
        expect(Object.keys(schedule)).toEqual(['slots', 'waiting'])
    })

    test('says who left a guest\'s registration by the name and address they left, and nothing else', async () => {
        const company = await createCompany('Gjest AS')
        const session = await sessionOfCompanyUser(company.id, 'gjest@example.com')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju med gjest', company.id)
        const guest = await eventRegistrationOperations.createGuest({
            params: { eventId, slotId: variant.slots[0].id },
            data: { name: 'Gjest Gjestesen', note: 'Kommer sent' },
            bypassAuth: true,
        })
        await prisma.contactDetails.update({
            where: { id: guest.contactId! },
            data: { email: 'gjest@example.org', mobile: '88888888' },
        })

        expect((await readSchedule(variant.id, session)).slots[0].holder).toEqual({
            name: 'Gjest Gjestesen',
            email: 'gjest@example.org',
            class: null,
            studyProgrammes: [],
        })
    })

    test('shows a slot whose holder was deleted as taken, by no one named', async () => {
        const company = await createCompany('Slettet AS')
        const session = await sessionOfCompanyUser(company.id, 'slettet@example.com')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju med slettet bruker', company.id)
        const leaving = await createStudent(100)
        await register(eventId, leaving.id, variant.slots[0].id)
        await userOperations.destroy({ params: { id: leaving.id }, bypassAuth: true })

        expect((await readSchedule(variant.id, session)).slots[0].holder).toEqual({
            name: 'Ukjent',
            email: null,
            class: null,
            studyProgrammes: [],
        })
    })

    test('is read for each slotted variant of its own', async () => {
        const company = await createCompany('Flere Runder AS')
        const session = await sessionOfCompanyUser(company.id, 'runder@example.com')
        const { eventId, variants: [firstRound, secondRound] } = await createEvent('Speedintervju i to runder', company.id, {
            slotsPerVariant: [2, 1],
        })
        await register(eventId, students[3].id, secondRound.slots[0].id, secondRound.id)

        expect(await readSchedule(firstRound.id, session)).toEqual({ slots: firstRound.slots.map(free), waiting: 0 })
        expect((await readSchedule(secondRound.id, session)).slots.map(slot => slot.holder?.name))
            .toEqual(['Student Nummer 3'])
    })

    test('is seen of a draft', async () => {
        const company = await createCompany('Utkast AS')
        const session = await sessionOfCompanyUser(company.id, 'utkast@example.com')
        const { variants: [variant] } = await createEvent('Speedintervju som utkast', company.id, { published: false })

        expect(await readSchedule(variant.id, session)).toEqual({ slots: variant.slots.map(free), waiting: 0 })
    })

    test('follows a schedule changed with people in it', async () => {
        const company = await createCompany('Ny Timeplan AS')
        const session = await sessionOfCompanyUser(company.id, 'nytimeplan@example.com')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju med ny timeplan', company.id)
        const registration = await register(eventId, students[4].id, variant.slots[1].id)

        const { variants } = await eventOperations.read({ params: { id: eventId }, bypassAuth: true })
        const [draft] = toVariantDrafts(variants)
        const [posted] = variantsToPost([withPlacesOfSlots({ ...draft, slotSchedule: scheduleOf(2, at(30)) })])
        await eventOperations.saveSetup({
            params: { id: eventId },
            data: {
                variants: [{
                    ...posted,
                    slotPlacing: {
                        removeEveryone: false,
                        placements: [{ registrationId: registration.id, slotStart: at(45) }],
                    },
                }],
            },
            bypassAuth: true,
        })

        const schedule = await readSchedule(variant.id, session)
        expect(schedule.slots.map(slot => [slot.start, slot.holder?.name ?? null])).toEqual([
            [at(30), null],
            [at(45), 'Student Nummer 4'],
        ])
    })
})

describe('the schedule of a speed interview', () => {
    test('is refused to a visitor, a user, an administrator and the users of another company', async () => {
        const company = await createCompany('Egen AS')
        const other = await createCompany('Annen AS')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju for andre', company.id)
        await register(eventId, students[0].id, variant.slots[0].id)
        const user = await userOperations.read({ params: { id: students[5].id }, bypassAuth: true })

        const sessions = [
            Session.empty(),
            Session.fromJsObject({ memberships: [], permissions: [], user }),
            Session.fromJsObject({ memberships: [], permissions: ['EVENT_ADMIN'], user }),
            await sessionOfCompanyUser(other.id, 'annen@example.com'),
        ]
        for (const session of sessions) {
            await expect(readSchedule(variant.id, session)).rejects.toMatchObject({
                errorCode: session.user || session.companyUser ? 'UNAUTHORIZED' : 'UNAUTHENTICATED',
            })
        }
    })

    test('is refused to the company once it is taken off the event', async () => {
        const company = await createCompany('Fjernet AS')
        const session = await sessionOfCompanyUser(company.id, 'fjernet@example.com')
        const { eventId, variants: [variant] } = await createEvent('Speedintervju uten bedrift', company.id)
        await expect(readSchedule(variant.id, session)).resolves.toBeDefined()

        await eventOperations.update({ params: { id: eventId }, data: { companyId: 'NULL' }, bypassAuth: true })

        await expect(readSchedule(variant.id, session)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
    })

    test('is not a thing of a presentation or an ordinary event, with slots and the same company', async () => {
        const company = await createCompany('Annen Type AS')
        const session = await sessionOfCompanyUser(company.id, 'annentype@example.com')
        for (const kind of ['COMPANY_PRESENTATION', 'ORDINARY'] as const) {
            const { eventId, variants: [variant] } = await createEvent(`Med tidsluker, ${kind}`, company.id, { kind })
            await register(eventId, students[0].id, variant.slots[0].id)

            await expect(readSchedule(variant.id, session)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        }
    })
})
