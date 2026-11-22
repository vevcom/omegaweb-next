import { activeMembersOf, testSession } from 'tests/utils'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { eventOperations } from '@/services/events/operations'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { lockEvent } from '@/services/events/registration/queue'
import { userOperations } from '@/services/users/operations'
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { AnySession, SessionCompanyUser } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'
import type { VisibilityRequirement } from '@/services/visibility/types'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const time = {
    eventStart: new Date(Math.floor(Date.now() / HOUR) * HOUR + 48 * HOUR),
    eventEnd: new Date(Math.floor(Date.now() / HOUR) * HOUR + 51 * HOUR),
}
const period = {
    registrationStart: new Date(Date.now() - HOUR),
    registrationEnd: new Date(Date.now() + 24 * HOUR),
    takesPayment: false,
}
const hiddenRefusal = 'Du kan ikke melde deg på dette arrangementet.'
const refusalNaming = (name: string) => `Du må ha plass på ${name} for å melde deg på. En plass på ventelisten holder ikke.`
const refusedWith = (message: string) => ({ errors: [expect.objectContaining({ message })] })

const notifySpy = jest.spyOn(eventNotificationOperations.internal.createInfoNotification, 'internalCall')
const subscribe = eventNotificationOperations.internal.subscribeToInfoChannel
const subscribeOriginal = subscribe.internalCall.bind(subscribe)
const subscribeSpy = jest.spyOn(subscribe, 'internalCall')
/** Runs inside the transaction of a registration, once it is placed and before it is saved. */
let whileRegistering: (() => Promise<void>) | null = null

let users: UserFiltered[]
let administrators: VisibilityRequirement[]

beforeAll(async () => {
    users = await Promise.all(Array.from({ length: 6 }, (_, index) => userOperations.create({
        data: {
            email: `presentation-seat-${index}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: `Testesen ${index}`,
            username: `presentation-seat-${index}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order,
            manualGroup: { create: { name: 'seat-admins', shortName: 'seat-admins' } },
        },
    })
    administrators = [{ conditions: [activeMembersOf(group.id)] }]
})

beforeEach(() => {
    whileRegistering = null
    subscribeSpy.mockImplementation(async (...args) => {
        await whileRegistering?.()
        return await subscribeOriginal(...args)
    })
})

afterAll(() => {
    subscribeSpy.mockRestore()
    notifySpy.mockRestore()
})

const sessionOf = (user: UserFiltered) => testSession({ user })

async function createEvent(
    kind: 'COMPANY_PRESENTATION' | 'SPEED_INTERVIEW',
    name: string,
    { places = 2, published = true, slotted = false } = {},
) {
    const { id } = await eventOperations.create({
        data: { kind, name, location: 'Realfagbygget', ...time, visibilityAdminRequirements: administrators },
        bypassAuth: true,
    })
    await eventOperations.saveSetup({
        params: { id },
        data: {
            waitingList: true,
            bindingRegistration: false,
            variants: [{
                name: 'Påmelding',
                ...period,
                ...(slotted ? {
                    registrationType: 'SLOTTED' as const,
                    slotSchedule: {
                        start: time.eventStart,
                        slotMinutes: 10,
                        breakMinutes: 5,
                        totalMinutes: 15 * places - 5,
                        longBreakEveryMinutes: null,
                        longBreakMinutes: null,
                    },
                } : {}),
                quotas: [{ name: 'Alle', places, visibilityRequirements: [] }],
            }],
        },
        bypassAuth: true,
    })
    if (published) await prisma.event.update({ where: { id }, data: { published: true, canBeViewedBy: 'ALL' } })
    return id
}

type Requirement = { companyPresentationId?: number | 'NULL', requiresPresentationSeat?: boolean }

const setRequirement = (id: number, data: Requirement) => (
    eventOperations.saveSetup({ params: { id }, data, bypassAuth: true })
)

/** A presentation, and a speed interview linked to it that requires a seat on it. */
async function createLinked(
    name: string,
    options: { presentationPublished?: boolean, slotted?: boolean, places?: number } = {},
) {
    const presentation = await createEvent('COMPANY_PRESENTATION', `Presentasjon: ${name}`, {
        places: 2,
        published: options.presentationPublished ?? true,
    })
    const interview = await createEvent('SPEED_INTERVIEW', `Intervju: ${name}`, {
        places: options.places ?? 3,
        slotted: options.slotted,
    })
    await setRequirement(interview, { companyPresentationId: presentation, requiresPresentationSeat: true })
    return { presentation, interview }
}


const register = (eventId: number, user: UserFiltered, session: AnySession = sessionOf(user), slotId?: number) => (
    eventRegistrationOperations.create({ params: { eventId, userId: user.id, slotId }, session })
)

const seat = (eventId: number, user: UserFiltered) => eventRegistrationOperations.createAsAdmin({
    params: { eventId, userId: user.id },
    bypassAuth: true,
})

const removeAsAdmin = (registrationId: number) => eventRegistrationOperations.destroyAsAdmin({
    params: { registrationId },
    bypassAuth: true,
})

const destroy = (eventId: number) => eventOperations.destroy({ params: { id: eventId }, bypassAuth: true })

const linkedOfInterview = async (id: number) => (
    await prisma.event.findUniqueOrThrow({ where: { id }, select: { companyPresentationId: true } })
).companyPresentationId

const registrationOf = (eventId: number, user: UserFiltered) => prisma.eventRegistration.findFirst({
    where: { userId: user.id, OR: [{ quota: { variant: { eventId } } }, { waitingListVariant: { eventId } }] },
})

describe('a speed interview that requires a seat on its presentation', () => {
    test('refuses a user without a seat while it is on, and lets them in once it is off', async () => {
        const { interview } = await createLinked('Uten plass')
        const [user] = users

        await expect(register(interview, user)).rejects.toMatchObject(refusedWith(refusalNaming('Presentasjon: Uten plass')))
        expect(await registrationOf(interview, user)).toBeNull()

        await setRequirement(interview, { requiresPresentationSeat: false })
        await register(interview, user)
        expect(await registrationOf(interview, user)).toMatchObject({ state: 'IN_QUOTA' })
    })

    test('lets in a user with a seat, and not one on the waiting list of the presentation', async () => {
        const { presentation, interview } = await createLinked('Med plass')
        const [first, second, third] = users
        await seat(presentation, first)
        await seat(presentation, second)
        await seat(presentation, third)
        expect(await registrationOf(presentation, third)).toMatchObject({ state: 'WAITING_LIST' })

        await register(interview, first)
        expect(await registrationOf(interview, first)).toMatchObject({ state: 'IN_QUOTA' })
        await expect(register(interview, third)).rejects.toMatchObject(refusedWith(refusalNaming('Presentasjon: Med plass')))
    })

    test('is not in force without the link', async () => {
        const { interview } = await createLinked('Uten kobling')
        await setRequirement(interview, { companyPresentationId: 'NULL' })

        await register(interview, users[0])
        expect(await registrationOf(interview, users[0])).toMatchObject({ state: 'IN_QUOTA' })
        const read = await eventOperations.read({ params: { id: interview }, session: sessionOf(users[0]) })
        expect(read.requiresPresentationSeat).toBe(false)
    })

    test('does not hold an administrator registering someone, nor a guest', async () => {
        const { interview } = await createLinked('Administrator')

        await seat(interview, users[0])
        await eventRegistrationOperations.createGuest({
            params: { eventId: interview },
            data: { name: 'Gjest', note: '' },
            bypassAuth: true,
        })
        expect(await registrationOf(interview, users[0])).toMatchObject({ state: 'IN_QUOTA' })
        expect(await prisma.eventRegistration.count({
            where: { contactId: { not: null }, quota: { variant: { eventId: interview } } },
        })).toBe(1)
    })

    test('gives a freed slot to the first who waits with a seat, past one who lost theirs', async () => {
        const { presentation, interview } = await createLinked('Ledig tidsluke', { slotted: true, places: 1 })
        const [holder, lost, kept] = users
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: presentation } }, data: { places: 3 } })
        const seats = []
        for (const user of [holder, lost, kept]) seats.push(await seat(presentation, user))
        const [slot] = await prisma.eventSlot.findMany({ where: { variant: { eventId: interview } } })

        await register(interview, holder, sessionOf(holder), slot.id)
        await register(interview, lost)
        await register(interview, kept)
        await removeAsAdmin(seats[1].id)

        await removeAsAdmin((await registrationOf(interview, holder))!.id)

        expect(await registrationOf(interview, kept)).toMatchObject({ state: 'IN_QUOTA', slotId: slot.id })
        expect(await registrationOf(interview, lost)).toMatchObject({ state: 'WAITING_LIST', slotId: null })
    })

    test('gives a freed place to a guest who waits, who can hold no seat', async () => {
        const { presentation, interview } = await createLinked('Gjest venter', { places: 1 })
        const [holder] = users
        await seat(presentation, holder)
        await register(interview, holder)
        const guest = await eventRegistrationOperations.createGuest({
            params: { eventId: interview },
            data: { name: 'Gjest som venter', note: '' },
            bypassAuth: true,
        })
        expect(guest.state).toBe('WAITING_LIST')

        await removeAsAdmin((await registrationOf(interview, holder))!.id)

        expect(await prisma.eventRegistration.findUniqueOrThrow({ where: { id: guest.id } }))
            .toMatchObject({ state: 'IN_QUOTA' })
    })

    test('lets one with a place move up to a quota before theirs, though they have lost their seat', async () => {
        const { presentation, interview } = await createLinked('To kvoter')
        const [first, moving, waiting] = users
        const variant = await prisma.eventVariant.findFirstOrThrow({
            where: { eventId: interview },
            include: { quotas: true },
        })
        await eventOperations.saveSetup({
            params: { id: interview },
            data: {
                variants: [{
                    id: variant.id,
                    name: variant.name,
                    ...period,
                    quotas: [
                        { id: variant.quotas[0].id, name: 'Første', places: 1, visibilityRequirements: [] },
                        { name: 'Andre', places: 1, visibilityRequirements: [] },
                    ],
                }],
            },
            bypassAuth: true,
        })
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: presentation } }, data: { places: 3 } })
        const presentationSeats = []
        for (const user of [first, moving, waiting]) presentationSeats.push(await seat(presentation, user))
        for (const user of [first, moving, waiting]) await register(interview, user)
        const [firstQuota] = await prisma.eventQuota.findMany({
            where: { variant: { eventId: interview } },
            orderBy: { order: 'asc' },
        })
        expect(await registrationOf(interview, first)).toMatchObject({ quotaId: firstQuota.id })
        await removeAsAdmin(presentationSeats[1].id)

        await removeAsAdmin((await registrationOf(interview, first))!.id)

        expect(await registrationOf(interview, moving)).toMatchObject({ state: 'IN_QUOTA', quotaId: firstQuota.id })
    })

    test('keeps a registration when the seat is lost after it', async () => {
        const { presentation, interview } = await createLinked('Mister plassen etterpå')
        const presentationSeat = await seat(presentation, users[0])
        await register(interview, users[0])

        await removeAsAdmin(presentationSeat.id)

        expect(await registrationOf(interview, users[0])).toMatchObject({ state: 'IN_QUOTA' })
    })
})

/**
 * Registers the user for the speed interview, and removes their seat on the presentation while the
 * registration is placed and not yet saved. Whether the seat was gone before it was saved.
 */
async function registerWhileSeatIsRemoved(presentation: number, interview: number, user: UserFiltered) {
    const presentationSeat = await seat(presentation, user)
    let removal: Promise<unknown> = Promise.resolve()
    let removedWhileRegistering = false
    whileRegistering = async () => {
        whileRegistering = null
        let removed = false
        removal = removeAsAdmin(presentationSeat.id).then(() => {
            removed = true
        })
        await new Promise(resolve => setTimeout(resolve, 150))
        removedWhileRegistering = removed
    }
    await register(interview, user)
    await removal
    return removedWhileRegistering
}

describe('the seat being lost while registering', () => {
    test('is lost only once the registration is saved, which never stands on a seat lost before it', async () => {
        const { presentation, interview } = await createLinked('Samtidig tap')
        const [user] = users

        for (let round = 0; round < 6; round++) {
            expect(await registerWhileSeatIsRemoved(presentation, interview, user)).toBe(false)
            expect(await registrationOf(presentation, user)).toBeNull()
            await removeAsAdmin((await registrationOf(interview, user))!.id)
        }
    })

    test('at once, either lets the registration in on the seat or refuses it, and never fails otherwise', async () => {
        const { presentation, interview } = await createLinked('Samtidig')
        const [user] = users

        for (let round = 0; round < 20; round++) {
            const presentationSeat = await seat(presentation, user)
            const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))
            const [registration, removal] = await Promise.allSettled([
                delay(round % 3).then(() => register(interview, user)),
                delay((round + 1) % 3).then(() => removeAsAdmin(presentationSeat.id)),
            ])

            expect(removal.status).toBe('fulfilled')
            if (registration.status === 'rejected') {
                expect(registration.reason).toMatchObject(refusedWith(refusalNaming('Presentasjon: Samtidig')))
            } else {
                await removeAsAdmin(registration.value.id)
            }
        }
    })
})

describe('what is said of a presentation the viewer may not see', () => {
    const companyUser = Session.fromJsObject({
        user: null,
        companyUser: { id: 4, admin: false, company: { id: 999999 } } as SessionCompanyUser['companyUser'],
        permissions: [],
        memberships: [],
    })

    test('is nothing, in the read, the refusal and whether the seat is held', async () => {
        const { interview } = await createLinked('Hemmelig', { presentationPublished: false })
        const [user] = users

        for (const session of [sessionOf(user), testSession({}), companyUser]) {
            const read = await eventOperations.read({ params: { id: interview }, session })
            expect(read.companyPresentation).toBeNull()
            expect(read.requiresPresentationSeat).toBe(false)
            expect(read).not.toHaveProperty('companyPresentationId')
            expect(JSON.stringify(read)).not.toContain('Presentasjon: Hemmelig')
        }

        const refusal = await register(interview, user).catch((error: unknown) => error)
        expect(refusal).toMatchObject(refusedWith(hiddenRefusal))
        expect(JSON.stringify(refusal)).not.toContain('Presentasjon: Hemmelig')

        expect(await eventRegistrationOperations.readSeatRefusal({
            params: { eventId: interview, userId: user.id },
            session: sessionOf(user),
        })).toBe(hiddenRefusal)
    })

    test('is named once the viewer may see it', async () => {
        const { presentation, interview } = await createLinked('Synlig')
        const [user] = users

        const read = await eventOperations.read({ params: { id: interview }, session: sessionOf(user) })
        expect(read.companyPresentation).toMatchObject({ id: presentation, name: 'Presentasjon: Synlig' })
        expect(read.requiresPresentationSeat).toBe(true)

        const refusalShown = () => eventRegistrationOperations.readSeatRefusal({
            params: { eventId: interview, userId: user.id },
            session: sessionOf(user),
        })
        const refused = await register(interview, user).catch((error: unknown) => error)
        expect(refused).toMatchObject(refusedWith(await refusalShown() ?? ''))
        expect(await refusalShown()).toBe(refusalNaming('Presentasjon: Synlig'))

        await seat(presentation, users[1])
        await seat(presentation, users[2])
        const waitingSeat = await seat(presentation, user)
        expect(waitingSeat.state).toBe('WAITING_LIST')
        expect(await refusalShown()).toBe(refusalNaming('Presentasjon: Synlig'))

        await removeAsAdmin((await registrationOf(presentation, users[1]))!.id)
        expect(await registrationOf(presentation, user)).toMatchObject({ state: 'IN_QUOTA' })
        expect(await refusalShown()).toBeNull()
    })
})

describe('publishing a speed interview that requires a seat', () => {
    test('waits for the presentation to be published and take registration', async () => {
        const { presentation, interview } = await createLinked('Publisering', { presentationPublished: false })
        await prisma.event.update({ where: { id: interview }, data: { published: false } })
        const asAdministrator = () => eventOperations.setPublished({
            params: { id: interview },
            data: { published: true },
            session: testSession({ permissions: ['EVENT_ADMIN'] }),
        })

        await expect(asAdministrator()).rejects.toMatchObject(
            refusedWith('Påmeldingen krever plass på bedriftspresentasjonen, som ikke er publisert.')
        )
        await prisma.event.update({ where: { id: presentation }, data: { published: true } })
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: presentation } }, data: { places: 0 } })
        await expect(asAdministrator()).rejects.toMatchObject(
            refusedWith('Påmeldingen krever plass på bedriftspresentasjonen, som ikke tar påmelding.')
        )
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: presentation } }, data: { places: 2 } })
        await asAdministrator()
        expect((await prisma.event.findUniqueOrThrow({ where: { id: interview } })).published).toBe(true)
    })

    test('says only that the presentation is not ready to one who may not see it', async () => {
        const { presentation, interview } = await createLinked('Skjult publisering', { presentationPublished: false })
        await prisma.event.update({ where: { id: interview }, data: { published: false } })
        const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
        const groupId = (administrators[0].conditions[0] as { groupId: number }).groupId
        const interviewAdministrator = testSession({
            user: users[5],
            memberships: [{ groupId, order, active: true, admin: false }],
        })
        await prisma.event.update({
            where: { id: presentation },
            data: { visibilityAdmin: { update: { requirements: { deleteMany: {} } } } },
        })
        await prisma.visibilityRequirement.create({
            data: {
                visibilityId: (await prisma.event.findUniqueOrThrow({ where: { id: presentation } })).visibilityAdminId,
            },
        })
        const publish = () => eventOperations.setPublished({
            params: { id: interview },
            data: { published: true },
            session: interviewAdministrator,
        })

        const refusal = await publish().catch((error: unknown) => error)
        expect(refusal).toMatchObject(
            refusedWith('Påmeldingen krever plass på en presentasjon som ikke er klar for påmelding.')
        )
        // The page reads the problems as publishing judges them, and gives them only to those who may publish.
        const read = (session: AnySession) => eventOperations.read({ params: { id: interview }, session })
        expect((await read(interviewAdministrator)).publishProblems)
            .toEqual(['Påmeldingen krever plass på en presentasjon som ikke er klar for påmelding.'])
        expect(JSON.stringify(refusal)).not.toContain('Skjult publisering')

        // Published, and still unseen: seen only by those who may register, through a quota that lets in no one.
        await prisma.event.update({ where: { id: presentation }, data: { published: true, canBeViewedBy: 'CAN_REGISTER' } })
        const [quota] = await prisma.eventQuota.findMany({ where: { variant: { eventId: presentation } } })
        await prisma.visibilityRequirement.create({ data: { visibilityId: quota.visibilityId } })
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: presentation } }, data: { places: 0 } })
        await expect(publish()).rejects.toMatchObject(
            refusedWith('Påmeldingen krever plass på en presentasjon som ikke er klar for påmelding.')
        )
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: presentation } }, data: { places: 2 } })
        expect((await read(interviewAdministrator)).publishProblems).toEqual([])
        await publish()
        expect((await read(testSession({}))).publishProblems).toBeNull()
    })
})

describe('the requirement', () => {
    test('is refused on an event of a kind that links to nothing', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Presentasjon som vil kreve')
        await expect(setRequirement(presentation, { requiresPresentationSeat: true })).rejects.toMatchObject(
            refusedWith('Bare et speedintervju kan kreve plass på en bedriftspresentasjon.')
        )
        expect((await prisma.event.findUniqueOrThrow({ where: { id: presentation } })).requiresPresentationSeat).toBe(false)
    })

    test('is not given back by the writes', async () => {
        const { interview } = await createLinked('Skrives tilbake')
        const written = [
            await setRequirement(interview, { requiresPresentationSeat: true }),
            await eventOperations.update({
                params: { id: interview },
                data: { name: 'Skrives tilbake, nytt' },
                bypassAuth: true,
            }),
            await eventOperations.setPublished({ params: { id: interview }, data: { published: true }, bypassAuth: true }),
        ]
        for (const event of written) expect(event).not.toHaveProperty('requiresPresentationSeat')
    })

    test('is not changed through update', async () => {
        const { interview } = await createLinked('Endres utenom')
        await eventOperations.update({
            params: { id: interview },
            data: { name: 'Endres utenom, nytt navn', requiresPresentationSeat: false } as { name: string },
            bypassAuth: true,
        })
        expect((await prisma.event.findUniqueOrThrow({ where: { id: interview } })).requiresPresentationSeat).toBe(true)
    })

    test('is gone with the presentation, and those who waited for want of a seat are seated and told', async () => {
        const { presentation, interview } = await createLinked('Slettet presentasjon', { places: 1 })
        const [holder, waiting] = users
        await seat(presentation, holder)
        await register(interview, holder)
        const waitingSeat = await seat(presentation, waiting)
        await register(interview, waiting)
        await removeAsAdmin(waitingSeat.id)
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: interview } }, data: { places: 2 } })
        notifySpy.mockClear()

        await eventOperations.destroy({ params: { id: presentation }, bypassAuth: true })

        expect(await registrationOf(interview, waiting)).toMatchObject({ state: 'IN_QUOTA' })
        expect(JSON.stringify(notifySpy.mock.calls)).toContain('rykket opp')
    })
})

describe('the locks of a speed interview and its presentation', () => {
    const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))
    const deadlocked = (results: PromiseSettledResult<unknown>[]) => results.filter(result => (
        result.status === 'rejected' && (result.reason as { errorCode?: string }).errorCode === 'SERVER ERROR'
    ))
    const variantsOf = (eventId: number) => prisma.eventVariant.findMany({ where: { eventId }, include: { quotas: true } })

    /** Saves the variants of the event as they are, under a new name, as the setup form does. */
    async function saveAsItIs(eventId: number, name: string) {
        const variants = await variantsOf(eventId)
        return await eventOperations.saveSetup({
            params: { id: eventId },
            data: {
                name,
                variants: variants.map(variant => ({
                    id: variant.id,
                    name: variant.name,
                    ...period,
                    quotas: variant.quotas.map(quota => ({
                        id: quota.id,
                        name: quota.name,
                        places: quota.places,
                        visibilityRequirements: [],
                    })),
                })),
            },
            bypassAuth: true,
        })
    }

    /**
     * A speed interview with one place, its holder, and two who wait and hold a seat, so that fixing
     * its places takes the presentation's lock.
     */
    async function withWaiting(name: string) {
        const linked = await createLinked(name, { places: 1 })
        await prisma.eventQuota.updateMany({ where: { variant: { eventId: linked.presentation } }, data: { places: 3 } })
        for (const user of users.slice(0, 3)) {
            await seat(linked.presentation, user)
            await register(linked.interview, user)
        }
        return linked
    }

    test('let a save of the speed interview and the deletion of its presentation both through', async () => {
        const rename = eventNotificationOperations.internal.renameChannels
        const renameOriginal = rename.internalCall.bind(rename)
        for (let round = 0; round < 4; round++) {
            const { presentation, interview } = await withWaiting(`Slettes under lagring ${round}`)
            let reached!: () => void
            const saveReached = new Promise<void>(resolve => {
                reached = resolve
            })
            // Started outside the save, so that it runs in a transaction of its own.
            const destroying = saveReached.then(() => destroy(presentation))
            const renameSpy = jest.spyOn(rename, 'internalCall').mockImplementation(async (...args) => {
                reached()
                await delay(300)
                return await renameOriginal(...args)
            })
            const results = await Promise.allSettled([saveAsItIs(interview, `Lagres under sletting ${round}`), destroying])
            renameSpy.mockRestore()

            expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled'])
            expect(await linkedOfInterview(interview)).toBeNull()
        }
    })

    test('let a save of the speed interview and the deletion of its presentation through at once, many rounds', async () => {
        for (let round = 0; round < 10; round++) {
            const { presentation, interview } = await withWaiting(`Samtidig sletting ${round}`)
            const results = await Promise.allSettled([
                delay(round % 3).then(() => saveAsItIs(interview, `Samtidig lagret ${round}`)),
                delay((round + 1) % 3).then(() => destroy(presentation)),
            ])
            expect(deadlocked(results)).toEqual([])
            expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled'])
        }
    })

    test('let a save of each event through at once, many rounds', async () => {
        const { presentation, interview } = await withWaiting('Begge lagres')
        for (let round = 0; round < 15; round++) {
            const results = await Promise.allSettled([
                delay(round % 3).then(() => saveAsItIs(interview, `Intervju lagret ${round}`)),
                delay((round + 1) % 3).then(() => saveAsItIs(presentation, `Presentasjon lagret ${round}`)),
            ])
            expect(deadlocked(results)).toEqual([])
            expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled'])
        }
    })

    test('let one leave the presentation while another registers for the speed interview, many rounds', async () => {
        const { presentation, interview } = await createLinked('Forlater og melder på')
        const [leaving, registering] = users
        for (let round = 0; round < 15; round++) {
            const leavingSeat = await seat(presentation, leaving)
            await seat(presentation, registering)
            const results = await Promise.allSettled([
                delay(round % 3).then(() => eventRegistrationOperations.destroy({
                    params: { registrationId: leavingSeat.id },
                    session: sessionOf(leaving),
                })),
                delay((round + 1) % 3).then(() => register(interview, registering)),
            ])
            expect(deadlocked(results)).toEqual([])
            expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled'])
            await removeAsAdmin((await registrationOf(interview, registering))!.id)
            await removeAsAdmin((await registrationOf(presentation, registering))!.id)
        }
    })

    test('let a link be made to a presentation being deleted, or refuse one of them, many rounds', async () => {
        for (let round = 0; round < 10; round++) {
            const presentation = await createEvent('COMPANY_PRESENTATION', `Kobles mens den slettes ${round}`)
            const interview = await createEvent('SPEED_INTERVIEW', `Kobler til en som slettes ${round}`)
            const results = await Promise.allSettled([
                delay(round % 3).then(() => setRequirement(interview, {
                    companyPresentationId: presentation,
                    requiresPresentationSeat: true,
                })),
                delay((round + 1) % 3).then(() => destroy(presentation)),
            ])
            expect(deadlocked(results)).toEqual([])
            expect(results.some(result => result.status === 'fulfilled')).toBe(true)
            expect(await linkedOfInterview(interview)).toBe(
                await prisma.event.count({ where: { id: presentation } }) > 0 ? presentation : null
            )
        }
    })
})

describe('a presentation being deleted', () => {
    /**
     * Holds the presentation's lock in a transaction of its own until the returned function lets go,
     * so that what waits for it can be lined up.
     */
    async function holdLockOf(eventId: number) {
        let letGo!: () => void
        const released = new Promise<void>(resolve => {
            letGo = resolve
        })
        let taken!: () => void
        const held = new Promise<void>(resolve => {
            taken = resolve
        })
        const holding = prisma.$transaction(async tx => {
            await lockEvent(tx, eventId)
            taken()
            await released
        }, { timeout: 20000 })
        await held
        return async () => {
            letGo()
            await holding
        }
    }
    const settled = <Result>(promise: Promise<Result>) => {
        const state = { done: false }
        const result = promise.then(
            value => ({ ok: true as const, value }),
            (error: unknown) => ({ ok: false as const, error }),
        ).finally(() => {
            state.done = true
        })
        return { state, result }
    }

    test('makes a link to it wait for its lock, and then refuses it', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Slettes før koblingen')
        const interview = await createEvent('SPEED_INTERVIEW', 'Kobles etter slettingen')
        const letGo = await holdLockOf(presentation)

        const destroying = settled(eventOperations.destroy({ params: { id: presentation }, bypassAuth: true }))
        await new Promise(resolve => setTimeout(resolve, 200))
        const linking = settled(setRequirement(interview, { companyPresentationId: presentation }))
        await new Promise(resolve => setTimeout(resolve, 200))
        const linkedWhileHeld = linking.state.done
        await letGo()

        expect(linkedWhileHeld).toBe(false)
        expect((await destroying.result).ok).toBe(true)
        expect((await linking.result).ok).toBe(false)
        expect(await linkedOfInterview(interview)).toBeNull()
    })

    test('is refused when a speed interview was linked to it since it let go of its own', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Koblet mens den slettes')
        const interview = await createEvent('SPEED_INTERVIEW', 'Koblet inn i slettingen')
        const letGo = await holdLockOf(presentation)

        const destroying = settled(eventOperations.destroy({ params: { id: presentation }, bypassAuth: true }))
        await new Promise(resolve => setTimeout(resolve, 200))
        // As a link saved before the deletion took the lock, which the lock held here lines up.
        await prisma.event.update({ where: { id: interview }, data: { companyPresentationId: presentation } })
        await letGo()

        const destroyed = await destroying.result
        expect(destroyed.ok).toBe(false)
        expect(destroyed.ok ? null : destroyed.error).toMatchObject(
            refusedWith('Et speedintervju ble koblet til bedriftspresentasjonen i det samme. Prøv igjen.')
        )
        expect(await linkedOfInterview(interview)).toBe(presentation)
    })
})
