import { eventOperations } from '@/services/events/operations'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000

/** An event that is over, so the archive lists it, and published, so a visitor sees it. */
async function createArchivedEvent(name: string, eventStart: Date) {
    const event = await eventOperations.create({
        data: {
            name,
            location: 'Omegakjelleren',
            eventStart,
            eventEnd: new Date(eventStart.getTime() + HOUR),
            canBeViewedBy: 'ALL',
            takesRegistration: true,
            places: 10,
            registrationStart: new Date(eventStart.getTime() - HOUR),
            registrationEnd: new Date(eventStart.getTime() - HOUR / 2),
            waitingList: true,
            tagIds: [],
            // No conditions is satisfiable by no one, so only EVENT_ADMIN administrates this event.
            visibilityAdminRequirements: [{ conditions: [] }],
        },
        bypassAuth: true,
    })
    await eventOperations.setPublished({
        params: { id: event.id },
        data: { published: true },
        bypassAuth: true,
    })
    return event
}

/** The first page of the archive of the past events. */
function readArchive() {
    return eventOperations.readManyArchivedPage({
        params: {
            paging: {
                page: { pageSize: 12, page: 0, cursor: null },
                details: { name: undefined, tags: null },
            },
        },
    })
}

describe('the archive of past events', () => {
    test('lists the most recent event first', async () => {
        await createArchivedEvent('Archive oldest', new Date('2018-01-01T10:00:00Z'))
        await createArchivedEvent('Archive newest', new Date('2024-01-01T10:00:00Z'))
        await createArchivedEvent('Archive middle', new Date('2021-01-01T10:00:00Z'))

        const events = await readArchive()

        expect(events.map(event => event.name)).toEqual([
            'Archive newest',
            'Archive middle',
            'Archive oldest',
        ])
    })

    test('leaves the events that are not over alone', async () => {
        await createArchivedEvent('Archive past', new Date('2019-01-01T10:00:00Z'))
        const coming = await eventOperations.create({
            data: {
                name: 'Archive coming',
                location: 'Omegakjelleren',
                eventStart: new Date(Date.now() + HOUR),
                eventEnd: new Date(Date.now() + 2 * HOUR),
                canBeViewedBy: 'ALL',
                takesRegistration: true,
                places: 10,
                registrationStart: new Date(Date.now() - HOUR),
                registrationEnd: new Date(Date.now() + HOUR),
                waitingList: true,
                tagIds: [],
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        await eventOperations.setPublished({
            params: { id: coming.id },
            data: { published: true },
            bypassAuth: true,
        })

        const events = await readArchive()
        const names = events.map(event => event.name)

        expect(names).toContain('Archive past')
        expect(names).not.toContain('Archive coming')
    })
})
