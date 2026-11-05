import '@pn-server-only'
import { eventAuth } from './auth'
import { eventSchemas } from './schemas'
import { assertSeenThroughQuotas, readEventAccess } from './access'
import {
    eventListSelection,
    eventQuotaOrder,
    eventVariantOrder,
    eventVariantSummarySelection,
} from './constants'
import { createVariant } from './variants/createVariant'
import { createQuota } from './quotas/createQuota'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { eventLinks } from '@/pageKits/events/links'
import { notificationOperations } from '@/services/notifications/operations'
import { getLocationMapData } from '@/lib/maps/locationMap'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { displayDate } from '@/lib/dates/displayDate'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementSearchOperation } from '@/services/search/implement'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { implementVisibilityOperations, toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventTag, Prisma } from '@/prisma-generated-pn-types'
import type { EventExpanded } from './types'
import type { SearchFindArgs } from '@/services/search/implement'
import type { EventPagesConfig } from '@/pageKits/events/config'

const DAY_MS = 1000 * 60 * 60 * 24

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
                variants: {
                    select: {
                        ...eventVariantSummarySelection,
                        quotas: {
                            select: {
                                ...eventVariantSummarySelection.quotas.select,
                                visibility: { include: visibilityIncluder },
                            },
                            orderBy: eventQuotaOrder,
                        },
                    },
                    orderBy: eventVariantOrder,
                },
            }
        })

        const expanded = withTagsAndVariantSummary(event)
        return {
            ...expanded,
            variants: expanded.variants.map(variant => ({
                ...variant,
                quotas: variant.quotas.map(({ visibility, ...quota }) => ({ ...quota, visibility: toMatrix(visibility) })),
            })),
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
            if (data.eventStart > data.eventEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Arrangementet må jo starte før det slutter')
            }
            if (data.takesPayment && !data.takesRegistration) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke ta betaling uten påmelding')
            }

            // The event and everything it owns are created together, so a failure leaves no
            // orphaned paragraph, image, visibility, variant or quota behind.
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
                        allowRegistrationInMultipleVariants: data.allowRegistrationInMultipleVariants,

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
                    const variant = await createVariant(tx, createdEvent.id, {
                        name: 'Påmelding',
                        registrationStart: data.registrationStart ?? new Date(),
                        registrationEnd: data.registrationEnd ?? new Date(Date.now() + DAY_MS),
                        takesPayment: data.takesPayment,
                        price: data.price,
                        paymentStart: data.paymentStart,
                        paymentEnd: data.paymentEnd,
                    })
                    await createQuota(tx, variant.id, {
                        name: 'Påmelding',
                        places: data.places ?? 0,
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
                    name: {
                        contains: params.name,
                        mode: 'insensitive'
                    },
                    eventTagEvents: eventTagSelector(params.tags),
                    ...prismaWhereFilter
                },
                orderBy: {
                    eventStart: 'asc'
                }
            })
            return events.map(withTagsAndVariantSummary)
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
            return events.map(withTagsAndVariantSummary)
        }
    }),

    /**
     * The events matching a free text query, the most recent ones first. Both past and coming
     * events are searched, and only the events the session may see at all - the very same
     * visibility rule as the lists of current and archived events above.
     */
    /** The search for a site's event pages: under a locked tag only the events carrying it, linking to those pages. */
    search: implementSearchOperation({
        authorizer: () => eventAuth.search,
        find: ({
            prisma, query, take, prismaWhereFilter, config
        }: SearchFindArgs<Prisma.EventWhereInput, EventPagesConfig>) => prisma.event.findMany({
            take,
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
                name: { contains: query, mode: 'insensitive' },
                eventTagEvents: config.lockedTag ? { some: { tag: { special: config.lockedTag } } } : undefined,
                ...prismaWhereFilter
            },
            orderBy: { eventStart: 'desc' },
        }),
        toSearchResult: (event, config) => ({
            key: `event-${event.id}`,
            href: eventLinks(config).event(event),
            label: event.name,
            sublabel: displayDate(event.eventStart, false),
            image: event.coverImage.image,
        }),
    }),

    update: defineOperation({
        paramsSchema: eventSchemas.params.update,
        dataSchema: eventSchemas.data.update,
        authorizer: async ({ params, prisma }) => eventAuth.update.data(await readEventAccess(prisma, params.id)),
        operation: async ({ prisma, params, data: { tagIds, locationMap, ...data } }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                include: { locationMap: true },
            })

            if ((data.eventStart ?? event.eventStart) > (data.eventEnd ?? event.eventEnd)) {
                throw new ServiceError('BAD PARAMETERS', 'Arrangementet må jo starte før det slutter')
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
                        locationMap: mapUpdate,
                    },
                })
                await assertSeenThroughQuotas(tx, params.id)
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
     * Publishes an event, or takes it back to being a draft. Publishing a draft tells the
     * subscribers to new events about it, those of them who may register through one of its quotas
     * as the quotas are when the notification is sent.
     */
    setPublished: defineOperation({
        paramsSchema: eventSchemas.params.setPublished,
        dataSchema: eventSchemas.data.setPublished,
        authorizer: async ({ params, prisma }) => eventAuth.setPublished.data(await readEventAccess(prisma, params.id)),
        operation: async ({ prisma, params, data }) => {
            if (data.published) await assertSeenThroughQuotas(prisma, params.id, { published: true })
            const { count: flipped } = await prisma.event.updateMany({
                where: { id: params.id, published: !data.published },
                data: { published: data.published },
            })
            const event = await prisma.event.findUniqueOrThrow({ where: { id: params.id } })

            if (data.published && flipped) {
                await notificationOperations.createSpecial.internalCall({
                    params: {
                        special: 'NEW_EVENT',
                    },
                    data: {
                        title: `Hvad der hender: ${event.name}`,
                        message: `${event.name}, 🕓 ${displayDate(event.eventStart, false)},📍 ${event.location}`,
                        url: omegaEventLinks.event(event),
                        audience: { canRegisterForEventId: event.id },
                    },
                })
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
                select: {
                    visibilityAdminId: true,
                    variants: { select: { quotas: { select: { visibilityId: true } } } },
                },
            })
            const registrationsOfEvent: Prisma.EventRegistrationWhereInput = {
                OR: [{ quota: { variant: { eventId: params.id } } }, { waitingListVariant: { eventId: params.id } }],
            }

            await prisma.$transaction(async tx => {
                // The registrations are locked first, as createPayment does, so no payment can start
                // between this check and the delete.
                await tx.$queryRaw`
                    SELECT r."id" FROM "EventRegistration" r
                    LEFT JOIN "EventQuota" q ON q."id" = r."quotaId"
                    LEFT JOIN "EventVariant" v ON v."id" = COALESCE(q."variantId", r."waitingListVariantId")
                    WHERE v."eventId" = ${params.id}
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
                const visibilityIds = [
                    event.visibilityAdminId,
                    ...event.variants.flatMap(variant => variant.quotas.map(quota => quota.visibilityId)),
                ]
                await Promise.all(visibilityIds.map(
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
    _count: { registrations: number },
}

type RawVariant<Quota extends RawQuota, VariantRest extends object> = {
    registrationStart: Date,
    registrationEnd: Date,
    takesPayment: boolean,
    quotas: Quota[],
    _count: { waitingListRegistrations: number },
} & VariantRest

/** What the quotas of a variant add up to. */
function withQuotaSummary<Quota extends RawQuota, Rest extends object>(
    { _count, quotas, ...variant }: { quotas: Quota[], _count: { waitingListRegistrations: number } } & Rest
) {
    const summarised = quotas.map(({ _count: quotaCount, ...quota }) => ({
        ...quota,
        numOfRegistrations: quotaCount.registrations,
    }))
    return {
        ...variant,
        quotas: summarised,
        takesRegistration: quotas.some(quota => quota.places > 0),
        places: quotas.reduce((sum, quota) => sum + quota.places, 0),
        numOfRegistrations: quotas.reduce((sum, quota) => sum + quota._count.registrations, 0),
        numOnWaitingList: _count.waitingListRegistrations,
    }
}

/** What the variants of an event add up to: whether it takes registration or payment, and its sums and spans. */
function withVariantSummary<Quota extends RawQuota, VariantRest extends object, Rest extends object>(
    { variants, ...event }: { variants: RawVariant<Quota, VariantRest>[] } & Rest
) {
    const summarised = variants.map(variant => withQuotaSummary(variant))
    const span = variants.reduce<{ start: number, end: number } | null>((current, variant) => ({
        start: Math.min(current?.start ?? Infinity, variant.registrationStart.getTime()),
        end: Math.max(current?.end ?? -Infinity, variant.registrationEnd.getTime()),
    }), null)

    return {
        ...event,
        variants: summarised,
        takesRegistration: summarised.some(variant => variant.takesRegistration),
        takesPayment: variants.some(variant => variant.takesPayment),
        places: summarised.reduce((sum, variant) => sum + variant.places, 0),
        numOfRegistrations: summarised.reduce((sum, variant) => sum + variant.numOfRegistrations, 0),
        numOnWaitingList: summarised.reduce((sum, variant) => sum + variant.numOnWaitingList, 0),
        registrationStart: span ? new Date(span.start) : null,
        registrationEnd: span ? new Date(span.end) : null,
    }
}

function withTagsAndVariantSummary<Quota extends RawQuota, VariantRest extends object, Rest extends object>(
    { eventTagEvents, ...event }: {
        variants: RawVariant<Quota, VariantRest>[],
        eventTagEvents: { tag: EventTag }[],
    } & Rest
) {
    return {
        ...withVariantSummary(event),
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
