import { eventOperations } from '@/services/events/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { Data } from '@/services/serviceOperation'

/**
 * Seeded content is administrated through the EVENT_ADMIN permission rather than by any group: a
 * requirement with no conditions can never be satisfied, so the admin level admits only those who
 * bypass it with that permission.
 */
const ADMINISTRATED_BY_PERMISSION_ONLY = [{ conditions: [] }]

type SeedDevEventConfig = {
    event: Data<typeof eventOperations.create>,
    registrationCount: number,
}

/**
 * Upserts the dev events. An event has no unique key of its own, so an existing one is recognised by
 * its name and left untouched - registrations included.
 */
export const seedDevEvents = defineSeedOperation(async (prisma: PrismaClient) => {
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)

    const startDate = new Date()
    startDate.setDate(today.getDate() + 7)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 1)

    const bedPresTag = await prisma.eventTag.findUniqueOrThrow({
        where: {
            special: 'COMPANY_PRESENTATION'
        }
    })

    const coverImage = await prisma.image.findUniqueOrThrow({
        where: {
            standardImage: 'FAIR',
        }
    })

    const events: SeedDevEventConfig[] = [
        {
            event: {
                name: 'Bedpres med Kongsberg',
                location: 'EL5',
                eventStart: startDate,
                eventEnd: endDate,
                canBeViewdBy: 'ALL',
                takesRegistration: true,
                places: 15,
                registrationStart: today,
                registrationEnd: tomorrow,
                waitingList: true,
                tagIds: [
                    bedPresTag.id,
                ],
                visibilityAdminRequirements: ADMINISTRATED_BY_PERMISSION_ONLY,
            },
            registrationCount: 10,
        },
        {
            event: {
                name: 'Stresset eksamenslesing',
                location: 'Lesesal',
                eventStart: startDate,
                eventEnd: endDate,
                canBeViewdBy: 'ALL',
                takesRegistration: false,
                waitingList: false,
                registrationStart: today,
                registrationEnd: tomorrow,
                tagIds: [],
                visibilityAdminRequirements: ADMINISTRATED_BY_PERMISSION_ONLY,
            },
            registrationCount: 0,
        },
        {
            event: {
                name: 'Ohma sin bursdag',
                location: 'Ohma',
                eventStart: startDate,
                eventEnd: endDate,
                canBeViewdBy: 'ALL',
                takesRegistration: true,
                waitingList: true,
                places: 50,
                registrationStart: today,
                registrationEnd: tomorrow,
                tagIds: [],
                visibilityAdminRequirements: ADMINISTRATED_BY_PERMISSION_ONLY,
            },
            registrationCount: 70,
        },
    ]

    await Promise.all(events.map(({ event, registrationCount }) => upsert({
        checkExistence: () => prisma.event.findFirst({
            where: { name: event.name },
            select: { id: true },
        }),
        create: () => createEvent(prisma, event, registrationCount, coverImage.id),
        update: () => Promise.resolve(),
    })))
})

async function createEvent(
    prisma: PrismaClient,
    event: Data<typeof eventOperations.create>,
    registrationCount: number,
    coverImageId: number,
) {
    const createdEvent = await eventOperations.create({ data: event })

    // Events are created as drafts, and a draft is visible only to those who administrate it - so
    // the seeded ones are published to make them show up in the development environment.
    await eventOperations.setPublished({
        params: { id: createdEvent.id },
        data: { published: true },
    })

    await prisma.cmsImage.update({
        where: { id: createdEvent.coverImageId },
        data: { imageId: coverImageId },
    })

    const users = await prisma.user.findMany({
        take: registrationCount,
        select: {
            id: true
        }
    })

    await prisma.eventRegistration.createMany({
        data: users.map(user => ({
            eventId: createdEvent.id,
            userId: user.id
        }))
    })
}
