import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { owIdToPnId, type IdMapper } from './IdMapper'
import { createProgressBar } from './progressBar'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { Limits } from './migrationLimits'
import type { UserMigrator } from './migrateUsers'

/**
 * The two visibility levels every event needs. Nothing in the old system restricted who could see
 * an event, so the regular level is created without requirements - which checkVisibility reads as
 * open to all. Administration is another matter: the admin level gets one requirement with no
 * conditions, which can never be satisfied, so migrated events are administrated by those who hold
 * the EVENT_ADMIN permission and no one else.
 */
async function createVisibilities(pnPrisma: PrismaClientPn) {
    const [visibilityRegular, visibilityAdmin] = await Promise.all([
        pnPrisma.visibility.create({ data: {} }),
        pnPrisma.visibility.create({ data: { requirements: { create: [{}] } } }),
    ])
    return {
        visibilityRegularId: visibilityRegular.id,
        visibilityAdminId: visibilityAdmin.id,
    }
}

/**
 * @returns IdMapper - Maps OW EventRegistrations.id to the PN EventRegistration.id created for it,
 * so later migrations (e.g. money/ledger) can link a transaction back to the right registration.
 */
export default async function migrateEvents(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    imageIdMap: IdMapper,
    userMigrator: UserMigrator,
    limits: Limits
): Promise<IdMapper> {
    const events = await owPrisma.events.findMany({
        take: limits.events ? limits.events : undefined,
        orderBy: limits.events ? {
            createdAt: 'desc'
        } : undefined,
        include: {
            Images: true,
            Committees: true,
            EventRegistrations: true,
        }
    })

    const eventsBar = createProgressBar('Migrating events', events.length)
    const registrationIdMapsPerEvent = await Promise.all(events.map(async event => {
        const coverId = owIdToPnId(imageIdMap, event.ImageId, 'images')
        const coverIage = await pnPrisma.cmsImage.create({
            data: {
                image: coverId ? {
                    connect: {
                        id: coverId,
                    }
                } : undefined
            }
        })
        const paragraph = await pnPrisma.cmsParagraph.create({
            data: {
                contentHtml: sanitizeHtml(event.text || ''),
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
            }
        })

        const newEvent = await pnPrisma.event.create({
            data: {
                name: event.title,
                location: event.location,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
                canBeViewdBy: 'ALL',
                takesRegistration: !!event.places && (event.places > 0),
                places: event.places || 0,
                eventStart: event.eventDate ?? event.createdAt,
                eventEnd: event.eventDate ?? event.createdAt,
                registrationStart: event.registrationStart ?? event.createdAt,
                registrationEnd: event.registrationDeadline ?? event.createdAt,
                coverImageId: coverIage.id,
                cmsParagraphId: paragraph.id,
                waitingList: event.waitingList ?? true,
                lead: event.lead,
                company: event.company,
                extraFields: event.extraFields ?? undefined,
                createdById: event.CreatedByUserId ? await userMigrator.getPnUserId(event.CreatedByUserId) : undefined,
                published: true,
                ...(await createVisibilities(pnPrisma)),
            }
        })

        const registrationIdMaps = await Promise.all(event.EventRegistrations.map(async registration => {
            const result = await pnPrisma.eventRegistration.create({
                data: {
                    eventId: newEvent.id,
                    company: registration.company,
                    manuallyPaid: registration.manPaid,
                    note: registration.note,
                    extraFieldChoices: registration.extraFieldChoices ?? undefined,
                    userId: registration.UserId ? await userMigrator.getPnUserId(registration.UserId) : undefined,
                }
            })
            if (registration.nameSpecified || registration.emailSpecified) {
                await pnPrisma.contactDetails.create({
                    data: {
                        name: registration.nameSpecified ?? '',
                        email: registration.emailSpecified ?? undefined,
                        EventRegistration: {
                            connect: {
                                id: result.id,
                            }
                        }
                    }
                })
            }

            return { owId: registration.id, pnId: result.id }
        }))

        eventsBar.increment()

        return registrationIdMaps
    }))
    eventsBar.stop()
    const eventRegistrationIdMap: IdMapper = registrationIdMapsPerEvent.flat()

    const simpleEvents = await owPrisma.simpleEvents.findMany({
        take: limits.events ? limits.events : undefined,
        include: {
            Committees: true,
        }
    })

    const simpleEventsBar = createProgressBar('Migrating simple events', simpleEvents.length)
    await Promise.all(simpleEvents.map(async simpleEvent => {
        const coverIage = await pnPrisma.cmsImage.create({
            data: {
                image: undefined
            }
        })
        const paragraph = await pnPrisma.cmsParagraph.create({
            data: {
                contentHtml: sanitizeHtml(simpleEvent.text || ''),
                createdAt: simpleEvent.createdAt,
                updatedAt: simpleEvent.updatedAt,
            }
        })

        await pnPrisma.event.create({
            data: {
                name: simpleEvent.title,
                createdAt: simpleEvent.createdAt,
                updatedAt: simpleEvent.updatedAt,
                canBeViewdBy: 'ALL',
                takesRegistration: false,
                places: 0,
                eventStart: simpleEvent.eventDate ?? simpleEvent.createdAt,
                eventEnd: simpleEvent.eventDate ?? simpleEvent.createdAt,
                registrationStart: simpleEvent.createdAt,
                registrationEnd: simpleEvent.createdAt,
                coverImageId: coverIage.id,
                cmsParagraphId: paragraph.id,
                waitingList: false,
                published: true,
                ...(await createVisibilities(pnPrisma)),
            }
        })
        simpleEventsBar.increment()
    }))
    simpleEventsBar.stop()

    return eventRegistrationIdMap
}
