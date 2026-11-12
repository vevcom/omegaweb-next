import { Session } from '@/auth/session/Session'
import { ServiceError, Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { careerFrontpageHighlightOperations } from '@/services/careers/frontpage/highlights/operations'
import { isHighlightShowable } from '@/services/careers/frontpage/highlights/constants'
import { eventOperations } from '@/services/events/operations'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR)

const admin = Session.fromJsObject({
    memberships: [],
    permissions: ['CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'],
    user: null,
})
const jobAdReader = Session.fromJsObject({ memberships: [], permissions: ['JOBAD_USE'], user: null })

let companyPresentationTagId: number
let companyId: number
let adminGroupId: number

async function createEvent({ tagged = true, published = true, startsIn = 10, endsIn = 12 }: {
    tagged?: boolean, published?: boolean, startsIn?: number, endsIn?: number,
} = {}) {
    const event = await eventOperations.create({
        data: {
            name: 'Bedpress hos Vevcom',
            location: 'Lophtet',
            eventStart: hoursFromNow(startsIn),
            eventEnd: hoursFromNow(endsIn),
            canBeViewedBy: 'ALL',
            takesRegistration: false,
            waitingList: false,
            tagIds: tagged ? [companyPresentationTagId] : [],
            visibilityAdminRequirements: [{ conditions: [{ type: 'ACTIVE', groupId: adminGroupId }] }],
        },
        bypassAuth: true,
    })
    if (published) {
        await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    }
    return event
}

async function createJobAd() {
    return await jobAdOperations.create({
        data: {
            articleName: 'Kakebaker',
            companyId,
            description: 'Vevcom søker en kakebaker',
            type: 'PART_TIME',
            applicationDeadline: hoursFromNow(100),
            rollingDueDate: false,
        },
        bypassAuth: true,
    })
}

const createHighlight = (
    target: { eventId: number } | { jobAdId: number },
    { start = hoursFromNow(-1), end = hoursFromNow(1) }: { start?: Date, end?: Date } = {},
) => careerFrontpageHighlightOperations.create({
    data: { eventId: 'NULL', jobAdId: 'NULL', ...target, start, end },
    session: admin,
})

const readCurrentIds = async (session: Session<'NO_USER'> | Session<'HAS_USER'> = Session.empty()) => (
    await careerFrontpageHighlightOperations.readCurrent({ session })
).map(highlight => highlight.id)

beforeAll(async () => {
    const tag = await prisma.eventTag.findUniqueOrThrow({ where: { special: 'COMPANY_PRESENTATION' } })
    companyPresentationTagId = tag.id
    const company = await prisma.company.create({
        data: { name: 'Vevcom Highlight AS', description: 'Bakeri' },
    })
    companyId = company.id
    adminGroupId = (await prisma.group.findFirstOrThrow()).id
})

afterEach(async () => {
    await prisma.careerFrontpageHighlight.deleteMany()
})

describe('career frontpage highlights', () => {
    test('only an administrator of them may create one', async () => {
        const event = await createEvent()
        await expect(careerFrontpageHighlightOperations.create({
            data: { eventId: event.id, jobAdId: 'NULL', start: hoursFromNow(-1), end: hoursFromNow(1) },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('must not end after the event does', async () => {
        const event = await createEvent({ endsIn: 12 })
        await expect(createHighlight({ eventId: event.id }, { end: hoursFromNow(13) }))
            .rejects.toThrow(new ServiceError('BAD PARAMETERS', 'Fremhevingen kan ikke slutte etter arrangementet'))
        await expect(createHighlight({ eventId: event.id }, { end: hoursFromNow(11) })).resolves.toBeDefined()
    })

    test('update is held to the same rule', async () => {
        const event = await createEvent({ endsIn: 12 })
        const highlight = await createHighlight({ eventId: event.id })
        await expect(careerFrontpageHighlightOperations.update({
            params: { id: highlight.id },
            data: { eventId: event.id, jobAdId: 'NULL', start: hoursFromNow(-1), end: hoursFromNow(13) },
            session: admin,
        })).rejects.toThrow(new ServiceError('BAD PARAMETERS', 'Fremhevingen kan ikke slutte etter arrangementet'))
    })

    test('must start before it ends', async () => {
        const event = await createEvent()
        const start = hoursFromNow(1)
        await expect(createHighlight({ eventId: event.id }, { start, end: start }))
            .rejects.toThrow(new ServiceError('BAD PARAMETERS', 'Fremhevingen må starte før den slutter'))
    })

    test('is of exactly one of an event and a job ad', async () => {
        const event = await createEvent()
        const jobAd = await createJobAd()
        const period = { start: hoursFromNow(-1), end: hoursFromNow(1) }
        const message = 'Velg enten en bedriftspresentasjon eller en jobbannonse'
        await expect(careerFrontpageHighlightOperations.create({
            data: { eventId: 'NULL', jobAdId: 'NULL', ...period },
            session: admin,
        })).rejects.toThrow(new ServiceError('BAD PARAMETERS', message))
        await expect(careerFrontpageHighlightOperations.create({
            data: { eventId: event.id, jobAdId: jobAd.id, ...period },
            session: admin,
        })).rejects.toThrow(new ServiceError('BAD PARAMETERS', message))
    })

    test('only published company presentations can be highlighted', async () => {
        const message = 'Bare publiserte bedriftspresentasjoner kan fremheves'
        const untagged = await createEvent({ tagged: false })
        const draft = await createEvent({ published: false })
        await expect(createHighlight({ eventId: untagged.id }))
            .rejects.toThrow(new ServiceError('BAD PARAMETERS', message))
        await expect(createHighlight({ eventId: draft.id }))
            .rejects.toThrow(new ServiceError('BAD PARAMETERS', message))
    })

    test('only active job ads can be highlighted', async () => {
        const jobAd = await createJobAd()
        await prisma.jobAd.update({ where: { id: jobAd.id }, data: { active: false } })
        await expect(createHighlight({ jobAdId: jobAd.id }))
            .rejects.toThrow(new ServiceError('BAD PARAMETERS', 'Bare aktive jobbannonser kan fremheves'))
    })

    test('reads only those whose period covers now', async () => {
        const event = await createEvent()
        const current = await createHighlight({ eventId: event.id })
        await createHighlight({ eventId: event.id }, { start: hoursFromNow(1), end: hoursFromNow(2) })
        await createHighlight({ eventId: event.id }, { start: hoursFromNow(-2), end: hoursFromNow(-1) })
        expect(await readCurrentIds()).toEqual([current.id])
    })

    test('stops showing when the event is moved earlier, unpublished or untagged', async () => {
        const moved = await createEvent()
        await createHighlight({ eventId: moved.id })
        await prisma.event.update({
            where: { id: moved.id },
            data: { eventStart: hoursFromNow(-3), eventEnd: hoursFromNow(-2) },
        })

        const unpublished = await createEvent()
        await createHighlight({ eventId: unpublished.id })
        await prisma.event.update({ where: { id: unpublished.id }, data: { published: false } })

        const untagged = await createEvent()
        await createHighlight({ eventId: untagged.id })
        await prisma.eventTagEvent.deleteMany({ where: { eventId: untagged.id } })

        expect(await readCurrentIds()).toEqual([])
    })

    test('hides events the reader may not see', async () => {
        const restricted = await createEvent()
        const highlight = await createHighlight({ eventId: restricted.id })
        await prisma.event.update({ where: { id: restricted.id }, data: { canBeViewedBy: 'CAN_REGISTER' } })
        expect(await readCurrentIds()).toEqual([])

        const eventAdministrator = Session.fromJsObject({
            memberships: [{ groupId: adminGroupId, order: 1, active: true, admin: false }],
            permissions: [],
            user: null,
        })
        expect(await readCurrentIds(eventAdministrator)).toEqual([highlight.id])
    })

    test('hides job ads from readers without JOBAD_USE', async () => {
        const jobAd = await createJobAd()
        const highlight = await createHighlight({ jobAdId: jobAd.id })
        expect(await readCurrentIds()).toEqual([])
        expect(await readCurrentIds(jobAdReader)).toEqual([highlight.id])
    })

    test('stops showing a job ad that is no longer active', async () => {
        const jobAd = await createJobAd()
        await createHighlight({ jobAdId: jobAd.id })
        await prisma.jobAd.update({ where: { id: jobAd.id }, data: { active: false } })
        expect(await readCurrentIds(jobAdReader)).toEqual([])
    })

    test('orders events by when they start, then job ads', async () => {
        const jobAd = await createJobAd()
        const later = await createEvent({ startsIn: 20, endsIn: 22 })
        const sooner = await createEvent({ startsIn: 10, endsIn: 12 })
        const jobAdHighlight = await createHighlight({ jobAdId: jobAd.id })
        const laterHighlight = await createHighlight({ eventId: later.id })
        const soonerHighlight = await createHighlight({ eventId: sooner.id })
        expect(await readCurrentIds(jobAdReader)).toEqual([soonerHighlight.id, laterHighlight.id, jobAdHighlight.id])
    })

    test('administrators can see, update and destroy expired ones', async () => {
        const event = await createEvent()
        const highlight = await createHighlight({ eventId: event.id }, {
            start: hoursFromNow(-2),
            end: hoursFromNow(-1),
        })
        const [read] = await careerFrontpageHighlightOperations.readMany({ session: admin })
        expect(read.id).toBe(highlight.id)

        const end = hoursFromNow(1)
        await careerFrontpageHighlightOperations.update({
            params: { id: highlight.id },
            data: { eventId: event.id, jobAdId: 'NULL', start: highlight.start, end },
            session: admin,
        })
        expect(await readCurrentIds()).toEqual([highlight.id])

        await careerFrontpageHighlightOperations.destroy({ params: { id: highlight.id }, session: admin })
        expect(await prisma.careerFrontpageHighlight.count()).toBe(0)
    })

    test('tells administrators which ones the front page hides', async () => {
        const shown = await createEvent()
        await createHighlight({ eventId: shown.id })
        const unpublished = await createEvent()
        await createHighlight({ eventId: unpublished.id })
        await prisma.event.update({ where: { id: unpublished.id }, data: { published: false } })
        const untagged = await createEvent()
        await createHighlight({ eventId: untagged.id })
        await prisma.eventTagEvent.deleteMany({ where: { eventId: untagged.id } })
        const moved = await createEvent()
        await createHighlight({ eventId: moved.id })
        await prisma.event.update({
            where: { id: moved.id },
            data: { eventStart: hoursFromNow(-3), eventEnd: hoursFromNow(-2) },
        })
        const jobAd = await createJobAd()
        await createHighlight({ jobAdId: jobAd.id })
        const inactiveJobAd = await createJobAd()
        await createHighlight({ jobAdId: inactiveJobAd.id })
        await prisma.jobAd.update({ where: { id: inactiveJobAd.id }, data: { active: false } })

        const now = new Date()
        const highlights = await careerFrontpageHighlightOperations.readMany({ session: admin })
        const showable = highlights
            .filter(highlight => isHighlightShowable(highlight, now))
            .map(highlight => highlight.event?.id ?? highlight.jobAd?.id)
        expect(showable).toHaveLength(2)
        expect(showable).toContain(shown.id)
        expect(showable).toContain(jobAd.id)
        expect(await readCurrentIds(jobAdReader)).toHaveLength(2)
    })

    test('offers the admin only what can be highlighted', async () => {
        const offered = await createEvent()
        const draft = await createEvent({ published: false })
        const untagged = await createEvent({ tagged: false })
        const jobAd = await createJobAd()
        const { events, jobAds } = await careerFrontpageHighlightOperations.readTargets({ session: admin })
        const eventIds = events.map(event => event.id)
        expect(eventIds).toContain(offered.id)
        expect(eventIds).not.toContain(draft.id)
        expect(eventIds).not.toContain(untagged.id)
        expect(jobAds.map(ad => ad.id)).toContain(jobAd.id)
    })

    test('goes with the event or job ad it highlights', async () => {
        const jobAd = await createJobAd()
        await createHighlight({ jobAdId: jobAd.id })
        await jobAdOperations.destroy({ params: { id: jobAd.id }, bypassAuth: true })
        expect(await prisma.careerFrontpageHighlight.count()).toBe(0)
    })
})
