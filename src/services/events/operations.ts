import '@pn-server-only'
import { eventAuth } from './auth'
import { eventSchemas } from './schemas'
import { defaultSearchResultLimit, eventListSelection } from './constants'
import { eventRegistrationQueueOrder } from './registration/constants'
import { notifyPromotedFromWaitingList } from './registration/notifyPromotedFromWaitingList'
import { notificationOperations } from '@/services/notifications/operations'
import { getOsloTime } from '@/lib/dates/getOsloTime'
import { getLocationMapData } from '@/lib/maps/locationMap'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { displayDate } from '@/lib/dates/displayDate'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import {
    assertAdminLevelIsSubOfRegularLevel,
    implementDoubleLevelVisibilityOperations,
    toMatrix,
    visibilityIncluder
} from '@/services/visibility/implement'
import type { VisibilityFilter } from '@/auth/visibility/visibilityFilter'
import type { EventCanView, EventTag, Prisma } from '@/prisma-generated-pn-types'
import type { EventExpanded } from './types'

const visibility = implementDoubleLevelVisibilityOperations({
    implementationParamsSchema: eventSchemas.params.visibility,
    authorizers: {
        readDoubleLevelMatrix: ({ doubleLevelMatrix }) =>
            eventAuth.readDoubleLevelMatrix.data({ visibility: doubleLevelMatrix }),
        updateRegularLevel: ({ doubleLevelMatrix }) =>
            eventAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix }),
        updateAdminLevel: ({ doubleLevelMatrix }) =>
            eventAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix })
    },
    readDoubleLevel: async ({ prisma, implementationParams, include }) => {
        const event = await prisma.event.findUniqueOrThrow({
            where: { id: implementationParams.id },
            include: {
                visibilityRegular: { include },
                visibilityAdmin: { include }
            }
        })
        return {
            regularLevel: event.visibilityRegular,
            adminLevel: event.visibilityAdmin
        }
    }
})

// TODO: Give dots to registrations from here, f.ex. to everyone that has not paid for an event / not met.
// The dots service exposes dotOperations.internal.createInternal for other services to give dots
// with, so this is a matter of an operation over the registrations of an event that implements it.

const read = defineOperation({
    paramsSchema: eventSchemas.params.read,
    authorizer: async ({ params, prisma }) => {
        const event = await prisma.event.findUniqueOrThrow({
            where: { id: params.id },
            select: {
                published: true,
                canBeViewdBy: true,
                visibilityRegular: { include: visibilityIncluder },
                visibilityAdmin: { include: visibilityIncluder }
            }
        })
        return eventAuth.read({
            level: readLevelOfEvent(event),
            doubleLevelMatrix: {
                regularLevel: toMatrix(event.visibilityRegular),
                adminLevel: toMatrix(event.visibilityAdmin)
            }
        })
    },
    operation: async ({ prisma, params }) => {
        const event = await prisma.event.findUniqueOrThrow({
            where: {
                id: params.id,
            },
            include: {
                locationMap: true,
                coverImage: {
                    include: {
                        image: { include: expandedImageIncluder }
                    }
                },
                paragraph: true,
                eventTagEvents: {
                    include: {
                        tag: true
                    }
                },
                _count: {
                    select: {
                        eventRegistrations: true,
                    },
                },
            }
        })

        return withTagsAndRegistrationCounts(event)
    }
})

export const eventOperations = {
    visibility,

    create: defineOperation({
        dataSchema: eventSchemas.data.create,
        authorizer: () => eventAuth.create,
        opensTransaction: true,
        operation: async ({ prisma, data, session }) => {
            assertAdminLevelIsSubOfRegularLevel({
                regularLevel: { requirements: data.visibilityRegularRequirements },
                adminLevel: { requirements: data.visibilityAdminRequirements },
            })
            assertValidEventDates(data)

            // The event and everything it owns are created together, so a failure leaves no
            // orphaned paragraph, image or visibilities behind.
            const event = await prisma.$transaction(async tx => {
                const cmsParagraph = await cmsParagraphOperations.create.internalCall({
                    data: {},
                    prisma: tx,
                    operationImplementationFields: { special: null }
                })
                const cmsImage = await cmsImageOperations.create.internalCall({
                    data: {},
                    prisma: tx,
                    operationImplementationFields: { special: null }
                })
                const visibilityRegular = await visibilityOperations.createWithRequirements.internalCall({
                    data: { requirements: data.visibilityRegularRequirements },
                    prisma: tx,
                })
                const visibilityAdmin = await visibilityOperations.createWithRequirements.internalCall({
                    data: { requirements: data.visibilityAdminRequirements },
                    prisma: tx,
                })

                const createdEvent = await tx.event.create({
                    data: {
                        name: data.name,
                        location: data.location,
                        locationMap: data.locationMap ? { create: getLocationMapData(data.locationMap) } : undefined,
                        eventStart: data.eventStart,
                        eventEnd: data.eventEnd,
                        takesRegistration: data.takesRegistration,
                        places: data.places,
                        registrationStart: data.registrationStart ?? getOsloTime(),
                        registrationEnd: data.registrationEnd ?? new Date(getOsloTime().getTime() + 1000 * 60 * 60 * 24),
                        canBeViewdBy: data.canBeViewdBy,
                        waitingList: data.waitingList,
                        price: data.price,
                        paymentStart: data.paymentStart,
                        paymentEnd: data.paymentEnd,

                        createdBy: session?.user ? {
                            connect: {
                                id: session.user.id
                            }
                        } : undefined,
                        paragraph: {
                            connect: {
                                id: cmsParagraph.id
                            }
                        },
                        coverImage: {
                            connect: {
                                id: cmsImage.id
                            }
                        },
                        visibilityRegular: {
                            connect: {
                                id: visibilityRegular.id
                            }
                        },
                        visibilityAdmin: {
                            connect: {
                                id: visibilityAdmin.id
                            }
                        }
                    }
                })
                await tx.eventTagEvent.createMany({
                    data: data.tagIds.map(tagId => ({
                        eventId: createdEvent.id,
                        tagId
                    }))
                })
                return createdEvent
            })

            await notificationOperations.createSpecial.internalCall({
                params: {
                    special: 'NEW_EVENT',
                },
                data: {
                    title: `Hva der hender: ${event.name}`,
                    message: `${event.name}, 🕓 ${displayDate(event.eventStart, false)},📍 ${event.location}`,
                    audience: { visibilityId: event.visibilityRegularId },
                },
            })
            return event
        }
    }),

    read,

    readManyCurrent: defineOperation({
        paramsSchema: eventSchemas.params.readManyCurrent,
        authorizer: () => eventAuth.readManyCurrent,
        operation: async ({ prisma, params }, visibilityWhereFilter): Promise<EventExpanded[]> => {
            const events = await prisma.event.findMany({
                select: eventListSelection,
                where: {
                    eventEnd: {
                        gte: getOsloTime()
                    },
                    eventTagEvents: eventTagSelector(params.tags),
                    ...visibleEventsFilter(visibilityWhereFilter)
                },
                orderBy: {
                    eventStart: 'asc'
                }
            })
            return events.map(withTagsAndRegistrationCounts)
        }
    }),
    readManyArchivedPage: defineOperation({
        paramsSchema: eventSchemas.params.readManyArchivedPage,
        authorizer: () => eventAuth.readManyArchivedPage,
        operation: async ({ prisma, params }, visibilityWhereFilter): Promise<EventExpanded[]> => {
            const events = await prisma.event.findMany({
                ...cursorPagingSelection(params.paging.page),
                where: {
                    eventEnd: {
                        lt: getOsloTime()
                    },
                    name: {
                        contains: params.paging.details.name,
                        mode: 'insensitive'
                    },
                    eventTagEvents: eventTagSelector(params.paging.details.tags),
                    ...visibleEventsFilter(visibilityWhereFilter)
                },
                select: eventListSelection,
            })
            return events.map(withTagsAndRegistrationCounts)
        }
    }),

    /**
     * The event half of the global search: the few events best matching a free text query, for a
     * search box to show while the user types. Both past and coming events are searched, the most
     * recent ones first, and only the events the session may see at all - the very same
     * visibility rule as the lists of current and archived events above.
     */
    search: defineOperation({
        paramsSchema: eventSchemas.params.search,
        authorizer: () => eventAuth.search,
        operation: async ({ prisma, params }, visibilityWhereFilter) => await prisma.event.findMany({
            take: params.limit ?? defaultSearchResultLimit,
            select: {
                id: true,
                name: true,
                eventStart: true,
                coverImage: {
                    select: {
                        image: { include: expandedImageIncluder }
                    }
                }
            },
            where: {
                name: { contains: params.query, mode: 'insensitive' },
                ...visibleEventsFilter(visibilityWhereFilter)
            },
            orderBy: { eventStart: 'desc' },
        })
    }),

    update: defineOperation({
        paramsSchema: eventSchemas.params.update,
        dataSchema: eventSchemas.data.update,
        authorizer: async ({ params, prisma }) => eventAuth.update.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
        }),
        opensTransaction: true,
        operation: async ({ prisma, params, data: { tagIds, locationMap, ...data } }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                include: { locationMap: true },
            })

            assertValidEventDates({
                eventStart: data.eventStart ?? event.eventStart,
                eventEnd: data.eventEnd ?? event.eventEnd,
                registrationStart: data.registrationStart ?? event.registrationStart,
                registrationEnd: data.registrationEnd ?? event.registrationEnd,
                paymentStart: data.paymentStart ?? event.paymentStart,
                paymentEnd: data.paymentEnd ?? event.paymentEnd,
                price: data.price ?? event.price,
            })

            let mapUpdate: Prisma.EventLocationMapUpdateOneWithoutEventNestedInput | undefined
            if (locationMap) {
                const mapData = getLocationMapData(locationMap)
                mapUpdate = { upsert: { create: mapData, update: mapData } }
            } else if (locationMap === null && event.locationMap) {
                mapUpdate = { delete: true }
            }

            const { eventUpdate, promotedRegistrations } = await prisma.$transaction(async tx => {
                const updatedEvent = await tx.event.update({
                    where: { id: params.id },
                    data: {
                        ...data,
                        locationMap: mapUpdate,
                    },
                })
                if (tagIds) {
                    await tx.eventTagEvent.deleteMany({
                        where: {
                            eventId: params.id,
                            NOT: {
                                tagId: {
                                    in: tagIds
                                }
                            }
                        }
                    })

                    await tx.eventTagEvent.createMany({
                        data: tagIds.map(tagId => ({
                            eventId: params.id,
                            tagId
                        })),
                        skipDuplicates: true
                    })
                }

                // More places promote the registrations queueing right past the old ones.
                const promoted = updatedEvent.places > event.places ? await tx.eventRegistration.findMany({
                    where: {
                        eventId: params.id,
                    },
                    orderBy: eventRegistrationQueueOrder,
                    skip: event.places,
                    take: updatedEvent.places - event.places,
                    select: {
                        userId: true,
                        contact: {
                            select: {
                                email: true,
                            },
                        },
                    },
                }) : []

                return { eventUpdate: updatedEvent, promotedRegistrations: promoted }
            })

            if (promotedRegistrations.length) {
                await notifyPromotedFromWaitingList(eventUpdate.name, promotedRegistrations)
            }

            return eventUpdate
        }
    }),

    updateCmsCoverImage: cmsImageOperations.update.implement({
        implementationParamsSchema: eventSchemas.params.updateCmsCoverImage,
        authorizer: async ({ implementationParams, prisma }) => eventAuth.updateCmsCoverImage.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({
                params: { id: implementationParams.eventId }, prisma
            })
        }),
        ownershipCheck: async ({ implementationParams, params }) =>
            (await read({
                params: { id: implementationParams.eventId },
                bypassAuth: true,
            })).coverImage.id === params.cmsImageId
    }),

    /**
     * Publishes an event, or takes it back to being a draft. Which level the read authorizer
     * demands follows from this flag, so retracting an event hides it from everyone but those who
     * administrate it again.
     */
    setPublished: defineOperation({
        paramsSchema: eventSchemas.params.setPublished,
        dataSchema: eventSchemas.data.setPublished,
        authorizer: async ({ params, prisma }) => eventAuth.setPublished.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
        }),
        operation: async ({ prisma, params, data }) => prisma.event.update({
            where: { id: params.id },
            data: { published: data.published },
        })
    }),

    destroy: defineOperation({
        paramsSchema: eventSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => eventAuth.destroy.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
        }),
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: { visibilityAdminId: true, visibilityRegularId: true },
            })

            await prisma.$transaction(async tx => {
                await tx.event.delete({
                    where: {
                        id: params.id
                    }
                })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: event.visibilityAdminId },
                })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: event.visibilityRegularId },
                })
            })
        }
    }),

    updateParagraphContent: cmsParagraphOperations.updateContent.implement({
        implementationParamsSchema: eventSchemas.params.updateParagraphContent,
        authorizer: async ({ implementationParams, prisma }) => eventAuth.updateParagraphContent.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({
                params: { id: implementationParams.eventId }, prisma
            })
        }),
        ownershipCheck: async ({ implementationParams, params }) =>
            (await read({
                params: { id: implementationParams.eventId },
                bypassAuth: true,
            })).paragraph.id === params.paragraphId
    })
} as const

/**
 * Replaces the raw count of registrations of an event with the numbers that are exposed: how many
 * took the places of the event, and how many queue on the waiting list past them.
 */
function withRegistrationCounts<RawEvent extends { places: number, _count: { eventRegistrations: number } }>(
    { _count, ...event }: RawEvent
) {
    return {
        ...event,
        numOfRegistrations: Math.min(_count.eventRegistrations, event.places),
        numOnWaitingList: Math.max(0, _count.eventRegistrations - event.places),
    }
}

/** An event as the lists and the event page show it: with its tags and its registration counts. */
function withTagsAndRegistrationCounts<RawEvent extends {
    places: number,
    _count: { eventRegistrations: number },
    eventTagEvents: { tag: EventTag }[],
}>({ eventTagEvents, ...event }: RawEvent) {
    return {
        ...withRegistrationCounts(event),
        tags: eventTagEvents.map(eventTagEvent => eventTagEvent.tag),
    }
}

function eventTagSelector(tags: string[] | null) {
    return tags ? {
        some: {
            tag: {
                name: {
                    in: tags
                }
            }
        }
    } : undefined
}

/**
 * Which visibility level it takes to see one event: while it is unpublished only those who
 * administrate it, and once published everyone - unless the event is limited to those who can
 * register for it, which is what its regular level decides.
 */
function readLevelOfEvent(event: { published: boolean, canBeViewdBy: EventCanView }): 'PUBLIC' | 'REGULAR' | 'ADMIN' {
    if (!event.published) return 'ADMIN'
    return event.canBeViewdBy === 'ALL' ? 'PUBLIC' : 'REGULAR'
}

/**
 * The same rule as readLevelOfEvent, as a filter over a list of events.
 *
 * The visibility filter is undefined only when the session bypasses visibility with EVENT_ADMIN,
 * which administrates every event - hence no filtering at all in that case.
 */
function visibleEventsFilter(visibilityWhereFilter: VisibilityFilter | undefined): Prisma.EventWhereInput {
    if (!visibilityWhereFilter) return {}
    return {
        OR: [
            { published: false, visibilityAdmin: visibilityWhereFilter },
            { published: true, canBeViewdBy: 'ALL' },
            { published: true, canBeViewdBy: 'CAN_REGISTER', visibilityRegular: visibilityWhereFilter },
        ]
    }
}

type EventDates = {
    eventStart: Date,
    eventEnd: Date,
    registrationStart?: Date,
    registrationEnd?: Date,
    paymentStart?: Date | null,
    paymentEnd?: Date | null,
    price?: number | null,
}

/**
 * An event ends after it starts, its registration and payment periods are each given whole or not
 * at all and end after they start, and an event with a price has a payment period. `update` passes
 * the dates the event will have after the update, so a partial update is judged as a whole.
 */
function assertValidEventDates(dates: EventDates) {
    if (dates.eventStart > dates.eventEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Event må jo starte før den slutter')
    }
    if (dates.registrationStart && dates.registrationEnd && dates.registrationStart > dates.registrationEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Påmelding må jo starte før den slutter')
    }
    if (Boolean(dates.registrationStart) !== Boolean(dates.registrationEnd)) {
        throw new ServiceError('BAD PARAMETERS', 'Begge registreringsdatoer må være satt eller ingen')
    }
    if (dates.paymentStart && dates.paymentEnd && dates.paymentStart > dates.paymentEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Betaling må jo starte før den slutter')
    }
    if (Boolean(dates.paymentStart) !== Boolean(dates.paymentEnd)) {
        throw new ServiceError('BAD PARAMETERS', 'Begge betalingsdatoer må være satt eller ingen')
    }
    if (dates.price && (!dates.paymentStart || !dates.paymentEnd)) {
        throw new ServiceError('BAD PARAMETERS', 'Betalingsdatoer må settes når arrangementet har en pris')
    }
}
