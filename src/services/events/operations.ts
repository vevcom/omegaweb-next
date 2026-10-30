import '@pn-server-only'
import { eventAuth } from './auth'
import { eventSchemas } from './schemas'
import { readEventAccess } from './access'
import { defaultSearchResultLimit, eventListSelection, eventQuotaOrder, eventQuotaSummarySelection } from './constants'
import { createQuota } from './quotas/createQuota'
import { notificationOperations } from '@/services/notifications/operations'
import { getLocationMapData } from '@/lib/maps/locationMap'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { displayDate } from '@/lib/dates/displayDate'
import { formatVevenUri } from '@/lib/urlEncoding'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { implementVisibilityOperations, toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventTag, Prisma } from '@/prisma-generated-pn-types'
import type { EventExpanded } from './types'

const DAY_MS = 1000 * 60 * 60 * 24

/** What an event that does not take payment holds in the payment fields. */
const unpaid = { paymentStart: null, paymentEnd: null }

const adminVisibility = implementVisibilityOperations({
    implementationParamsSchema: eventSchemas.params.adminVisibility,
    authorizers: {
        readMatrix: async ({ params, prisma }) => eventAuth.readAdminVisibility.data(
            await readEventAccess(prisma, params.id)
        ),
        update: async ({ implementationParams, prisma }) => eventAuth.updateAdminVisibility.data(
            await readEventAccess(prisma, implementationParams.id)
        ),
    },
    readVisibility: async ({ prisma, implementationParams, include }) => (
        await prisma.event.findUniqueOrThrow({
            where: { id: implementationParams.id },
            select: { visibilityAdmin: { include } },
        })
    ).visibilityAdmin,
    emptyMeans: 'REFUSED',
})

const read = defineOperation({
    paramsSchema: eventSchemas.params.read,
    authorizer: async ({ params, prisma }) => eventAuth.read.data(await readEventAccess(prisma, params.id)),
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
                hostedByCommittee: { select: { id: true, name: true, shortName: true } },
                ledgerAccount: { select: { id: true, name: true } },
                quotas: {
                    select: {
                        ...eventQuotaSummarySelection,
                        visibility: { include: visibilityIncluder },
                    },
                    orderBy: eventQuotaOrder,
                },
                _count: {
                    select: {
                        waitingListRegistrations: true,
                    },
                },
            }
        })

        const expanded = withTagsAndQuotaSummary(event)
        return {
            ...expanded,
            quotas: expanded.quotas.map(({ visibility, ...quota }) => ({ ...quota, visibility: toMatrix(visibility) })),
        }
    }
})

export const eventOperations = {
    adminVisibility,

    create: defineOperation({
        dataSchema: eventSchemas.data.create,
        authorizer: () => eventAuth.create,
        opensTransaction: true,
        operation: async ({ prisma, data, session }) => {
            assertValidEventDates(data)
            if (data.takesPayment && !data.takesRegistration) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke ta betaling uten påmelding')
            }

            // The event and everything it owns are created together, so a failure leaves no
            // orphaned paragraph, image, visibility or quota behind.
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
                        canBeViewedBy: data.canBeViewedBy,
                        hostedByCommittee: data.hostedByCommitteeId ? {
                            connect: {
                                id: data.hostedByCommitteeId
                            }
                        } : undefined,
                        waitingList: data.waitingList,
                        bindingRegistration: data.bindingRegistration,
                        takesPayment: data.takesPayment,
                        ...(data.takesPayment
                            ? { paymentStart: data.paymentStart, paymentEnd: data.paymentEnd }
                            : unpaid),

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

                if (data.takesRegistration) {
                    await createQuota(tx, createdEvent, {
                        name: 'Påmelding',
                        places: data.places ?? 0,
                        price: data.price,
                        registrationStart: data.registrationStart ?? new Date(),
                        registrationEnd: data.registrationEnd ?? new Date(Date.now() + DAY_MS),
                        visibilityRequirements: data.quotaVisibilityRequirements,
                    })
                }
                return createdEvent
            })

            // A new event is a draft. Subscribers hear of it once it is published (see setPublished).
            return event
        }
    }),

    read,

    readManyCurrent: defineOperation({
        paramsSchema: eventSchemas.params.readManyCurrent,
        authorizer: () => eventAuth.readManyCurrent,
        operation: async ({ prisma, params }, prismaWhereFilter): Promise<EventExpanded[]> => {
            const events = await prisma.event.findMany({
                select: eventListSelection,
                where: {
                    eventEnd: {
                        gte: new Date()
                    },
                    eventTagEvents: eventTagSelector(params.tags),
                    ...prismaWhereFilter
                },
                orderBy: {
                    eventStart: 'asc'
                }
            })
            return events.map(withTagsAndQuotaSummary)
        }
    }),
    readManyArchivedPage: defineOperation({
        paramsSchema: eventSchemas.params.readManyArchivedPage,
        authorizer: () => eventAuth.readManyArchivedPage,
        operation: async ({ prisma, params }, prismaWhereFilter): Promise<EventExpanded[]> => {
            const events = await prisma.event.findMany({
                ...cursorPagingSelection(params.paging.page),
                where: {
                    eventEnd: {
                        lt: new Date()
                    },
                    name: {
                        contains: params.paging.details.name,
                        mode: 'insensitive'
                    },
                    eventTagEvents: eventTagSelector(params.paging.details.tags),
                    ...prismaWhereFilter
                },
                select: eventListSelection,
            })
            return events.map(withTagsAndQuotaSummary)
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
        operation: async ({ prisma, params }, prismaWhereFilter) => await prisma.event.findMany({
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
                ...prismaWhereFilter
            },
            orderBy: { eventStart: 'desc' },
        })
    }),

    update: defineOperation({
        paramsSchema: eventSchemas.params.update,
        dataSchema: eventSchemas.data.update,
        authorizer: async ({ params, prisma }) => eventAuth.update.data(await readEventAccess(prisma, params.id)),
        operation: async ({ prisma, params, data: { tagIds, locationMap, ...data } }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                include: {
                    locationMap: true,
                    quotas: { select: { price: true } },
                },
            })

            const takesPayment = data.takesPayment ?? event.takesPayment
            assertValidEventDates({
                eventStart: data.eventStart ?? event.eventStart,
                eventEnd: data.eventEnd ?? event.eventEnd,
                takesPayment,
                paymentStart: data.paymentStart ?? event.paymentStart,
                paymentEnd: data.paymentEnd ?? event.paymentEnd,
            })
            if (takesPayment && event.quotas.some(quota => quota.price === null)) {
                throw new ServiceError('BAD PARAMETERS', 'Alle kvotene må ha en pris når arrangementet tar betaling')
            }

            let mapUpdate: Prisma.EventLocationMapUpdateOneWithoutEventNestedInput | undefined
            if (locationMap) {
                const mapData = getLocationMapData(locationMap)
                mapUpdate = { upsert: { create: mapData, update: mapData } }
            } else if (locationMap === null && event.locationMap) {
                mapUpdate = { delete: true }
            }

            return await prisma.$transaction(async tx => {
                const updatedEvent = await tx.event.update({
                    where: { id: params.id },
                    data: {
                        ...data,
                        ...(takesPayment ? {} : unpaid),
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
                return updatedEvent
            })
        }
    }),

    /**
     * Links an event to the GROUP ledger account its registrations are paid into, replacing any
     * earlier link.
     * @param params.id - The event to link
     * @param data.ledgerAccountId - The account to credit
     */
    connectToLedgerAccount: defineOperation({
        paramsSchema: eventSchemas.params.connectToLedgerAccount,
        dataSchema: eventSchemas.data.connectToLedgerAccount,
        authorizer: async ({ params, data, prisma }) => eventAuth.connectToLedgerAccount.data({
            ...await readEventAccess(prisma, params.id),
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: data.ledgerAccountId })],
        }),
        operation: async ({ prisma, params, data }) => {
            const account = await prisma.ledgerAccount.findUniqueOrThrow({
                where: { id: data.ledgerAccountId },
                select: { type: true },
            })
            if (account.type !== 'GROUP') {
                throw new ServiceError('BAD PARAMETERS', 'Et arrangement kan bare knyttes til en gruppekonto.')
            }

            return await prisma.event.update({
                where: { id: params.id },
                data: { ledgerAccountId: data.ledgerAccountId },
            })
        },
    }),

    updateCmsCoverImage: cmsImageOperations.update.implement({
        implementationParamsSchema: eventSchemas.params.updateCmsCoverImage,
        authorizer: async ({ implementationParams, prisma }) => eventAuth.updateCmsCoverImage.data(
            await readEventAccess(prisma, implementationParams.eventId)
        ),
        ownershipCheck: async ({ implementationParams, params }) =>
            (await read({
                params: { id: implementationParams.eventId },
                bypassAuth: true,
            })).coverImage.id === params.cmsImageId
    }),

    /**
     * Publishes an event, or takes it back to being a draft. Which rule `canSeeEvent` applies
     * follows from this flag, so retracting an event hides it from everyone but those who
     * administrate it again. Publishing a draft tells the subscribers to new events about it,
     * those of them who may register through one of its quotas.
     */
    setPublished: defineOperation({
        paramsSchema: eventSchemas.params.setPublished,
        dataSchema: eventSchemas.data.setPublished,
        authorizer: async ({ params, prisma }) => eventAuth.setPublished.data(await readEventAccess(prisma, params.id)),
        operation: async ({ prisma, params, data }) => {
            const { count: flipped } = await prisma.event.updateMany({
                where: { id: params.id, published: !data.published },
                data: { published: data.published },
            })
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                include: { quotas: { select: { visibilityId: true } } },
            })

            if (data.published && flipped) {
                // A notification reaches one visibility, so there is one per quota. Those passing
                // several quotas hear of the event once per quota.
                const quotaAudiences = event.quotas.map(quota => ({ visibilityId: quota.visibilityId }))
                const everyone = event.canBeViewedBy === 'ALL' ? [{}] : []
                const audiences = event.quotas.length > 0 ? quotaAudiences : everyone
                await Promise.all(audiences.map(audience => notificationOperations.createSpecial.internalCall({
                    params: {
                        special: 'NEW_EVENT',
                    },
                    data: {
                        title: `Hvad der hender: ${event.name}`,
                        message: `${event.name}, 🕓 ${displayDate(event.eventStart, false)},📍 ${event.location}`,
                        url: `/events/${formatVevenUri(event.name, event.id)}`,
                        audience,
                    },
                })))
            }

            return event
        }
    }),

    destroy: defineOperation({
        paramsSchema: eventSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => eventAuth.destroy.data(await readEventAccess(prisma, params.id)),
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: { visibilityAdminId: true, quotas: { select: { visibilityId: true } } },
            })
            const registrationsOfEvent: Prisma.EventRegistrationWhereInput = {
                OR: [{ quota: { eventId: params.id } }, { waitingListEventId: params.id }],
            }

            await prisma.$transaction(async tx => {
                // The registrations are locked first, as createPayment does, so no payment can start
                // between this check and the delete.
                await tx.$queryRaw`
                    SELECT r."id" FROM "EventRegistration" r
                    LEFT JOIN "EventRegistrationQuota" q ON q."id" = r."quotaId"
                    WHERE q."eventId" = ${params.id} OR r."waitingListEventId" = ${params.id}
                    FOR UPDATE OF r
                `
                const liveTransaction = await tx.ledgerTransaction.findFirst({
                    where: {
                        eventRegistration: registrationsOfEvent,
                        OR: [{ state: 'PENDING' }, validTransactionFilter],
                    },
                    select: { id: true },
                })
                if (liveTransaction) {
                    throw new ServiceError(
                        'BAD PARAMETERS',
                        'Arrangementet har betalte påmeldinger eller betalinger under behandling. '
                        + 'Meld av deltakerne først, så de får pengene tilbake.'
                    )
                }

                // Registrations go first: deleting the event cascades to its quotas, which refuse
                // to go while they hold any.
                await tx.eventRegistration.deleteMany({ where: registrationsOfEvent })
                await tx.event.delete({
                    where: {
                        id: params.id
                    }
                })
                await Promise.all([event.visibilityAdminId, ...event.quotas.map(quota => quota.visibilityId)].map(
                    visibilityId => visibilityOperations.destroy.internalCall({ prisma: tx, params: { visibilityId } })
                ))
            })
        }
    }),

    updateParagraphContent: cmsParagraphOperations.updateContent.implement({
        implementationParamsSchema: eventSchemas.params.updateParagraphContent,
        authorizer: async ({ implementationParams, prisma }) => eventAuth.updateParagraphContent.data(
            await readEventAccess(prisma, implementationParams.eventId)
        ),
        ownershipCheck: async ({ implementationParams, params }) =>
            (await read({
                params: { id: implementationParams.eventId },
                bypassAuth: true,
            })).paragraph.id === params.paragraphId
    })
} as const

type RawQuota = {
    places: number,
    registrationStart: Date,
    registrationEnd: Date,
    _count: { registrations: number },
}

/**
 * Adds up what the quotas of an event give it: whether it takes registration, its places and
 * registrations, and the registration period spanning the quotas'. The waiting list is the event's
 * own.
 */
function withQuotaSummary<Quota extends RawQuota, Rest extends object>(
    { _count, quotas, ...event }: { quotas: Quota[], _count: { waitingListRegistrations: number } } & Rest
) {
    const summarised = quotas.map(({ _count: quotaCount, ...quota }) => ({
        ...quota,
        numOfRegistrations: quotaCount.registrations,
    }))
    const span = quotas.reduce<{ start: number, end: number } | null>((current, quota) => ({
        start: Math.min(current?.start ?? Infinity, quota.registrationStart.getTime()),
        end: Math.max(current?.end ?? -Infinity, quota.registrationEnd.getTime()),
    }), null)

    return {
        ...event,
        quotas: summarised,
        takesRegistration: quotas.length > 0,
        places: quotas.reduce((sum, quota) => sum + quota.places, 0),
        numOfRegistrations: quotas.reduce((sum, quota) => sum + quota._count.registrations, 0),
        numOnWaitingList: _count.waitingListRegistrations,
        registrationStart: span ? new Date(span.start) : null,
        registrationEnd: span ? new Date(span.end) : null,
    }
}

/** An event as the lists and the event page show it: with its tags and what its quotas add up to. */
function withTagsAndQuotaSummary<Quota extends RawQuota, Rest extends object>({ eventTagEvents, ...event }: {
    quotas: Quota[],
    _count: { waitingListRegistrations: number },
    eventTagEvents: { tag: EventTag }[],
} & Rest) {
    return {
        ...withQuotaSummary(event),
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

type EventDates = {
    eventStart: Date,
    eventEnd: Date,
    takesPayment: boolean,
    paymentStart?: Date | null,
    paymentEnd?: Date | null,
}

/**
 * An event ends after it starts, and one that takes payment has a payment period that ends after
 * it starts. `update` passes the values the event will have after the update, so a partial update
 * is judged as a whole. The registration periods are the quotas' to validate.
 */
function assertValidEventDates(dates: EventDates) {
    if (dates.eventStart > dates.eventEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Arrangementet må jo starte før det slutter')
    }
    if (!dates.takesPayment) return
    if (!dates.paymentStart || !dates.paymentEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Betalingsdatoer må settes når arrangementet tar betaling')
    }
    if (dates.paymentStart > dates.paymentEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Betalingen må jo starte før den slutter')
    }
}
