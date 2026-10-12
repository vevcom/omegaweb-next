import '@pn-server-only'
import { eventAuth } from './auth'
import { eventSchemas } from './schemas'
import { defaultSearchResultLimit, eventFilterSelection } from './constants'
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
import { z } from 'zod'
import type { VisibilityFilter } from '@/auth/visibility/visibilityFilter'
import type { EventCanView, Prisma } from '@/prisma-generated-pn-types'
import type { EventExpanded } from './types'

const visibility = implementDoubleLevelVisibilityOperations({
    implementationParamsSchema: eventSchemas.params,
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

// TODO: Give dots to registrations from here, f.ex. to everyone that has not paid for an event / not met.
// The dots service exposes dotOperations.internal.createInternal for other services to give dots
// with, so this is a matter of an operation over the registrations of an event that implements it.

const read = defineOperation({
    paramsSchema: eventSchemas.params,
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

        return {
            ...withRegistrationCounts(event),
            tags: event.eventTagEvents.map(eventTagEvent => eventTagEvent.tag)
        }
    }
})

export const eventOperations = {
    visibility,

    create: defineOperation({
        dataSchema: eventSchemas.create,
        authorizer: () => eventAuth.create,
        operation: async ({ prisma, data, session }) => {
            assertAdminLevelIsSubOfRegularLevel({
                regularLevel: { requirements: data.visibilityRegularRequirements },
                adminLevel: { requirements: data.visibilityAdminRequirements },
            })

            if (data.eventStart > data.eventEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Event må jo strate før den slutter')
            }

            if (data.registrationStart && data.registrationEnd && data.registrationStart > data.registrationEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Påmelding må jo strate før den slutter')
            }

            if (data.registrationStart && !data.registrationEnd || !data.registrationStart && data.registrationEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Begge registreringsdatoer må være satt eller ingen')
            }

            if (data.paymentStart && data.paymentEnd && data.paymentStart > data.paymentEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Betaling må jo strate før den slutter')
            }

            if (data.paymentStart && !data.paymentEnd || !data.paymentStart && data.paymentEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Begge betalingsdatoer må være satt eller ingen')
            }

            if (data.price && (!data.paymentStart || !data.paymentEnd)) {
                throw new ServiceError('BAD PARAMETERS', 'Betalingsdatoer må settes når arrangementet har en pris')
            }

            const cmsParagraph = await cmsParagraphOperations.create.internalCall({
                data: {},
                operationImplementationFields: { special: null }
            })
            const cmsImage = await cmsImageOperations.create.internalCall({
                data: {},
                operationImplementationFields: { special: null }
            })

            const visibilityRegular = await visibilityOperations.createWithRequirements.internalCall({
                data: { requirements: data.visibilityRegularRequirements },
            })
            const visibilityAdmin = await visibilityOperations.createWithRequirements.internalCall({
                data: { requirements: data.visibilityAdminRequirements },
            })

            const event = await prisma.event.create({
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
            await prisma.eventTagEvent.createMany({
                data: data.tagIds.map(tagId => ({
                    eventId: event.id,
                    tagId
                }))
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
        paramsSchema: z.object({
            tags: z.array(z.string()).nullable(),
        }),
        authorizer: () => eventAuth.readManyCurrent,
        operation: async ({ prisma, params }, visibilityWhereFilter): Promise<EventExpanded[]> => {
            const events = await prisma.event.findMany({
                select: {
                    ...eventFilterSelection,
                    coverImage: {
                        include: {
                            image: { include: expandedImageIncluder }
                        }
                    },
                    eventTagEvents: {
                        include: {
                            tag: true
                        }
                    }
                },
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
            return events.map(event => ({
                ...withRegistrationCounts(event),
                tags: event.eventTagEvents.map(eventTagEvent => eventTagEvent.tag)
            }))
        }
    }),
    readManyArchivedPage: defineOperation({
        paramsSchema: eventSchemas.readManyArchivedPage,
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
                select: {
                    ...eventFilterSelection,
                    coverImage: {
                        include: {
                            image: { include: expandedImageIncluder }
                        }
                    },
                    eventTagEvents: {
                        include: {
                            tag: true
                        }
                    }
                },
            })
            return events.map(event => ({
                ...withRegistrationCounts(event),
                tags: event.eventTagEvents.map(eventTagEvent => eventTagEvent.tag)
            }))
        }
    }),

    /**
     * The event half of the global search: the few events best matching a free text query, for a
     * search box to show while the user types. Both past and coming events are searched, the most
     * recent ones first, and only the events the session may see at all - the very same
     * visibility rule as the lists of current and archived events above.
     */
    search: defineOperation({
        paramsSchema: eventSchemas.search,
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
        paramsSchema: eventSchemas.params,
        dataSchema: eventSchemas.update,
        authorizer: async ({ params, prisma }) => eventAuth.update.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
        }),
        operation: async ({ prisma, params, data: { tagIds, locationMap, ...data } }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                include: { locationMap: true },
            })

            if ((data.eventStart ?? event?.eventStart) > (data.eventEnd ?? event?.eventEnd)) {
                throw new ServiceError('BAD PARAMETERS', 'Event må jo strate før den slutter')
            }

            if (data.registrationStart && data.registrationEnd && data.registrationStart > data.registrationEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Påmelding må jo strate før den slutter')
            }

            if (data.registrationStart && !data.registrationEnd || !data.registrationStart && data.registrationEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Begge registreringsdatoer må være satt eller ingen')
            }

            if (data.paymentStart && data.paymentEnd && data.paymentStart > data.paymentEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Betaling må jo strate før den slutter')
            }

            if (data.paymentStart && !data.paymentEnd || !data.paymentStart && data.paymentEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Begge betalingsdatoer må være satt eller ingen')
            }

            const effectivePrice = data.price ?? event.price
            const effectivePaymentStart = data.paymentStart ?? event.paymentStart
            const effectivePaymentEnd = data.paymentEnd ?? event.paymentEnd
            if (effectivePrice && (!effectivePaymentStart || !effectivePaymentEnd)) {
                throw new ServiceError('BAD PARAMETERS', 'Betalingsdatoer må settes når arrangementet har en pris')
            }

            let mapUpdate: Prisma.EventLocationMapUpdateOneWithoutEventNestedInput | undefined
            if (locationMap) {
                const mapData = getLocationMapData(locationMap)
                mapUpdate = { upsert: { create: mapData, update: mapData } }
            } else if (locationMap === null && event.locationMap) {
                mapUpdate = { delete: true }
            }

            const eventUpdate = await prisma.event.update({
                where: { id: params.id },
                data: {
                    ...data,
                    locationMap: mapUpdate,
                },
            })
            if (tagIds) {
                await prisma.eventTagEvent.deleteMany({
                    where: {
                        eventId: params.id,
                        NOT: {
                            tagId: {
                                in: tagIds
                            }
                        }
                    }
                })

                await prisma.eventTagEvent.createMany({
                    data: tagIds.map(tagId => ({
                        eventId: params.id,
                        tagId
                    })),
                    skipDuplicates: true
                })
            }

            // More places promote the registrations queueing right past the old ones.
            if (eventUpdate.places > event.places) {
                const promotedRegistrations = await prisma.eventRegistration.findMany({
                    where: {
                        eventId: params.id,
                    },
                    orderBy: eventRegistrationQueueOrder,
                    skip: event.places,
                    take: eventUpdate.places - event.places,
                    select: {
                        userId: true,
                        contact: {
                            select: {
                                email: true,
                            },
                        },
                    },
                })
                await notifyPromotedFromWaitingList(eventUpdate.name, promotedRegistrations)
            }

            return eventUpdate
        }
    }),

    updateCmsCoverImage: cmsImageOperations.update.implement({
        implementationParamsSchema: z.object({
            eventId: z.number()
        }),
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
        paramsSchema: eventSchemas.params,
        dataSchema: eventSchemas.setPublished,
        authorizer: async ({ params, prisma }) => eventAuth.setPublished.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
        }),
        operation: async ({ prisma, params, data }) => prisma.event.update({
            where: { id: params.id },
            data: { published: data.published },
        })
    }),

    destroy: defineOperation({
        paramsSchema: eventSchemas.params,
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
        implementationParamsSchema: z.object({
            eventId: z.number()
        }),
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
