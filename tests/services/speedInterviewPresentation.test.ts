import { activeMembersOf, testSession } from 'tests/utils'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { AnySession } from '@/auth/session/Session'
import type { EventKind } from '@/prisma-generated-pn-types'
import type { VisibilityRequirement } from '@/services/visibility/types'

const HOUR = 60 * 60 * 1000

const secondLinkRefused = 'Bedriftspresentasjonen har allerede et speedintervju.'

const refusedWith = (errorCode: string, message?: string) => ({
    errorCode,
    ...(message ? { errors: [expect.objectContaining({ message })] } : {}),
})

let order: number
/** Administrates the speed interviews and the presentations alike. */
let both: { requirements: VisibilityRequirement[], session: AnySession }
/** Administrates the speed interviews alone. */
let interviewsOnly: { requirements: VisibilityRequirement[], session: AnySession }
let visitor: AnySession

async function administrators(shortName: string) {
    const group = await prisma.group.create({
        data: { groupType: 'MANUAL_GROUP', order, manualGroup: { create: { name: shortName, shortName } } },
    })
    const user = await userOperations.create({
        data: {
            email: `${shortName}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username: shortName,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
    return {
        requirements: [{ conditions: [activeMembersOf(group.id)] }],
        session: testSession({ user, memberships: [{ groupId: group.id, order, active: true, admin: false }] }),
    }
}

beforeAll(async () => {
    order = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    both = await administrators('link-both')
    interviewsOnly = await administrators('link-interviews')
    visitor = testSession({})
})

async function createEvent(
    kind: EventKind,
    name: string,
    { requirements = both.requirements, published = false, eventEnd = new Date(Date.now() + 50 * HOUR) } = {},
) {
    const event = await eventOperations.create({
        data: {
            kind,
            name,
            location: 'Realfagbygget',
            eventStart: new Date(eventEnd.getTime() - 2 * HOUR),
            eventEnd,
            takesRegistration: false,
            visibilityAdminRequirements: requirements,
        },
        bypassAuth: true,
    })
    if (published) await prisma.event.update({ where: { id: event.id }, data: { published: true } })
    return event.id
}

const link = (id: number, companyPresentationId: number | 'NULL', session = both.session) => eventOperations.saveSetup({
    params: { id },
    data: { companyPresentationId },
    session,
})

const linkedOf = async (id: number) => (
    await prisma.event.findUniqueOrThrow({ where: { id }, select: { companyPresentationId: true } })
).companyPresentationId

describe('the link of a speed interview to a company presentation', () => {
    test('is set and cleared through the setup of the speed interview', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Presentasjon som kobles')
        const interview = await createEvent('SPEED_INTERVIEW', 'Intervju som kobles')

        const saveForm = (fields: Record<string, string>) => {
            const form = new FormData()
            Object.entries(fields).forEach(([name, value]) => form.append(name, value))
            return eventOperations.saveSetup({ params: { id: interview }, data: form, session: both.session })
        }

        await saveForm({ companyPresentationId: String(presentation) })
        expect(await linkedOf(interview)).toBe(presentation)

        // The field posts nothing while it is left as it was, which keeps the link.
        await saveForm({ name: 'Intervju med nytt navn' })
        expect(await linkedOf(interview)).toBe(presentation)

        await saveForm({ companyPresentationId: 'NULL' })
        expect(await linkedOf(interview)).toBeNull()
    })

    test('is not set through update, which the name is changed with', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Presentasjon utenom oppsettet')
        const interview = await createEvent('SPEED_INTERVIEW', 'Intervju utenom oppsettet')

        await eventOperations.update({
            params: { id: interview },
            data: { name: 'Intervju med nytt navn utenom', companyPresentationId: presentation } as { name: string },
            session: both.session,
        })
        expect(await linkedOf(interview)).toBeNull()
    })

    test('is not given back by the writes, to an administrator who may not see the presentation', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Presentasjon som ikke vises')
        const interview = await createEvent('SPEED_INTERVIEW', 'Intervju som skrives')
        await link(interview, presentation)

        const written = [
            await link(interview, presentation),
            await eventOperations.update({
                params: { id: interview },
                data: { name: 'Intervju skrevet' },
                bypassAuth: true,
            }),
            await eventOperations.setPublished({
                params: { id: interview },
                data: { published: false },
                bypassAuth: true,
            }),
            await eventOperations.connectToLedgerAccount({
                params: { id: interview },
                data: {
                    ledgerAccountId: (await prisma.ledgerAccount.create({
                        data: {
                            type: 'GROUP',
                            name: 'Konto for intervjuet som skrives',
                            groups: { create: { groupId: both.requirements[0].conditions[0].groupId } },
                        },
                    })).id,
                },
                bypassAuth: true,
            }),
        ]
        for (const event of written) expect(event).not.toHaveProperty('companyPresentationId')
    })

    test('lets a presentation take one speed interview and no second', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Presentasjon med ett intervju')
        const first = await createEvent('SPEED_INTERVIEW', 'Første intervju')
        const second = await createEvent('SPEED_INTERVIEW', 'Andre intervju')

        await link(first, presentation)
        await expect(link(second, presentation))
            .rejects.toMatchObject(refusedWith('DUPLICATE', secondLinkRefused))
        expect(await linkedOf(first)).toBe(presentation)
        expect(await linkedOf(second)).toBeNull()

        await link(first, 'NULL')
        await link(second, presentation)
        expect(await linkedOf(second)).toBe(presentation)
    })

    test('of two speed interviews linking one presentation at once, links one and refuses the other', async () => {
        const [first, second] = await Promise.all([
            createEvent('SPEED_INTERVIEW', 'Samtidig, første'),
            createEvent('SPEED_INTERVIEW', 'Samtidig, andre'),
        ])
        for (let round = 0; round < 20; round++) {
            const presentation = await createEvent('COMPANY_PRESENTATION', `Samtidig presentasjon ${round}`)
            const links = await Promise.allSettled([link(first, presentation), link(second, presentation)])

            expect(links.filter(result => result.status === 'fulfilled')).toHaveLength(1)
            expect(links.flatMap(result => (result.status === 'rejected' ? [result.reason as unknown] : [])))
                .toEqual([expect.objectContaining(refusedWith('DUPLICATE', secondLinkRefused))])
            expect(await prisma.event.count({ where: { companyPresentationId: presentation } })).toBe(1)
        }
    })

    test.each([
        ['an ordinary event', 'ORDINARY', 'COMPANY_PRESENTATION'],
        ['a presentation', 'COMPANY_PRESENTATION', 'COMPANY_PRESENTATION'],
        ['a speed interview to another speed interview', 'SPEED_INTERVIEW', 'SPEED_INTERVIEW'],
        ['a speed interview to an ordinary event', 'SPEED_INTERVIEW', 'ORDINARY'],
    ] as const)('is refused from %s', async (name, from, to) => {
        const linked = await createEvent(to, `Kobles til fra ${name}`)
        const event = await createEvent(from, `Kobles fra ${name}`)

        await expect(link(event, linked)).rejects.toMatchObject(
            refusedWith('BAD PARAMETERS', 'Bare et speedintervju kobles til en bedriftspresentasjon.')
        )
        expect(await linkedOf(event)).toBeNull()
    })

    test('takes administrating the presentation to set or keep, and nothing more to clear', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Presentasjon andre administrerer')
        const conditions = [...both.requirements[0].conditions, ...interviewsOnly.requirements[0].conditions]
        const shared = await createEvent('SPEED_INTERVIEW', 'Intervju begge administrerer', {
            requirements: [{ conditions }],
        })

        await expect(link(shared, presentation, interviewsOnly.session))
            .rejects.toMatchObject(refusedWith('UNAUTHORIZED'))
        expect(await linkedOf(shared)).toBeNull()

        await link(shared, presentation, both.session)
        // Posting the id kept asks the same, so the id cannot be found by trying.
        await expect(link(shared, presentation, interviewsOnly.session))
            .rejects.toMatchObject(refusedWith('UNAUTHORIZED'))
        expect(await linkedOf(shared)).toBe(presentation)
        await link(shared, 'NULL', interviewsOnly.session)
        expect(await linkedOf(shared)).toBeNull()
    })

    test('is gone when the presentation is deleted, and the presentation is free when the speed interview is', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Presentasjon som slettes')
        const interview = await createEvent('SPEED_INTERVIEW', 'Intervju som blir stående')
        await link(interview, presentation)

        await eventOperations.destroy({ params: { id: presentation }, bypassAuth: true })
        expect(await linkedOf(interview)).toBeNull()

        const kept = await createEvent('COMPANY_PRESENTATION', 'Presentasjon som blir stående')
        const gone = await createEvent('SPEED_INTERVIEW', 'Intervju som slettes')
        await link(gone, kept)
        await eventOperations.destroy({ params: { id: gone }, bypassAuth: true })
        await link(interview, kept)
        expect(await linkedOf(interview)).toBe(kept)
    })
})

describe('the page of a linked event', () => {
    const read = (id: number, session: AnySession) => eventOperations.read({ params: { id }, session })

    test('shows the other event to those who may see it, and nothing of it to anyone else', async () => {
        const draft = await createEvent('COMPANY_PRESENTATION', 'Presentasjon i utkast')
        const interview = await createEvent('SPEED_INTERVIEW', 'Publisert intervju', { published: true })
        await prisma.event.update({ where: { id: interview }, data: { canBeViewedBy: 'ALL' } })
        await link(interview, draft)

        const seenByVisitor = await read(interview, visitor)
        expect(seenByVisitor.companyPresentation).toBeNull()
        expect(JSON.stringify(seenByVisitor)).not.toContain('Presentasjon i utkast')
        expect(seenByVisitor).not.toHaveProperty('companyPresentationId')

        expect((await read(interview, both.session)).companyPresentation)
            .toMatchObject({ id: draft, kind: 'COMPANY_PRESENTATION', name: 'Presentasjon i utkast' })
        expect((await read(draft, both.session)).speedInterview)
            .toMatchObject({ id: interview, kind: 'SPEED_INTERVIEW', name: 'Publisert intervju' })

        await prisma.event.update({ where: { id: draft }, data: { published: true, canBeViewedBy: 'ALL' } })
        expect((await read(interview, visitor)).companyPresentation?.id).toBe(draft)
    })

    test('of a presentation shows nothing of a draft speed interview', async () => {
        const presentation = await createEvent('COMPANY_PRESENTATION', 'Publisert presentasjon', { published: true })
        await prisma.event.update({ where: { id: presentation }, data: { canBeViewedBy: 'ALL' } })
        const draft = await createEvent('SPEED_INTERVIEW', 'Intervju i utkast')
        await link(draft, presentation)

        const seen = await read(presentation, visitor)
        expect(seen.speedInterview).toBeNull()
        expect(JSON.stringify(seen)).not.toContain('Intervju i utkast')
    })
})

describe('the presentations offered to link to', () => {
    test('are those coming that the session administrates, with no other speed interview', async () => {
        const interview = await createEvent('SPEED_INTERVIEW', 'Intervju som velger')
        const free = await createEvent('COMPANY_PRESENTATION', 'Ledig presentasjon')
        const linkedHere = await createEvent('COMPANY_PRESENTATION', 'Presentasjon koblet hit')
        const taken = await createEvent('COMPANY_PRESENTATION', 'Opptatt presentasjon')
        const ended = await createEvent('COMPANY_PRESENTATION', 'Ferdig presentasjon', {
            eventEnd: new Date(Date.now() - HOUR),
        })
        const others = await createEvent('COMPANY_PRESENTATION', 'Andres presentasjon', {
            requirements: interviewsOnly.requirements,
            published: true,
        })
        await prisma.event.update({ where: { id: others }, data: { canBeViewedBy: 'ALL' } })
        const ordinary = await createEvent('ORDINARY', 'Vanlig arrangement')
        await link(interview, linkedHere)
        await link(await createEvent('SPEED_INTERVIEW', 'Intervju som har tatt'), taken)

        const offered = (await eventOperations.readLinkable({ params: { id: interview }, session: both.session }))
            .map(event => event.id)
        expect(offered).toEqual(expect.arrayContaining([free, linkedHere]))
        for (const notOffered of [taken, ended, others, ordinary]) expect(offered).not.toContain(notOffered)

        expect(await eventOperations.readLinkable({ params: { id: free }, session: both.session })).toEqual([])
    })
})
