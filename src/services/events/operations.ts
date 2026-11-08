import '@pn-server-only'
import { eventAuth } from './auth'
import { eventSchemas } from './schemas'
import { assertSeenThroughQuotas, readEventAccess } from './access'
import { hasNoAdministrators, publishProblems } from './publishProblems'
import { applyRegistrationSetup } from './applyRegistrationSetup'
import { lockEvent } from './registration/queue'
import { notifyPromoted } from './registration/fixState'
import {
    eventListSelection,
    eventQuotaOrder,
    eventVariantOrder,
    eventVariantSummarySelection,
} from './constants'
import { createVariant } from './variants/createVariant'
import { createQuota } from './quotas/createQuota'
import { lockEvent } from './registration/queue'
import { eventNotificationOperations } from './notifications/operations'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { eventLinks } from '@/pageKits/events/links'
import { getLocationMapData } from '@/lib/maps/locationMap'
import { ServiceError } from '@/services/error'
import { defineOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { displayDate } from '@/lib/dates/displayDate'
import { reserveId } from '@/lib/reserveId'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { availableNotificationMethodIncluder } from '@/services/notifications/channels/subservice/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementSearchOperation } from '@/services/search/implement'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { implementVisibilityOperations, toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { VariantStatistics } from './statistics'
import type { EventTag, Prisma } from '@/prisma-generated-pn-types'
import type { EventExpanded } from './types'
import type { SearchFindArgs } from '@/services/search/implement'
import type { EventPagesConfig } from '@/pageKits/events/config'

const DAY_MS = 1000 * 60 * 60 * 24

// ponytail: a new event has no time yet, and the database requires one. Start and end both land here,
// so a draft stays on the current list and publishProblems sees them as unset until someone sets them.
// Make the columns nullable if drafts ever need to show that they have no time.
const UNSET_EVENT_TIME_OFFSET_MS = 7 * DAY_MS

// Administers nothing, so a draft from just a name is its creator's until someone is chosen.
const NO_ADMINISTRATORS = [{ conditions: [] }]

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
                notificationChannel: { include: availableNotificationMethodIncluder },
                infoNotificationChannel: { include: availableNotificationMethodIncluder },
                generalNotificationChannel: { include: availableNotificationMethodIncluder },
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

    /** Counts only, since those who administrate the event see the numbers without the people behind them. */
    readStatistics: defineOperation({
        paramsSchema: eventSchemas.params.readStatistics,
        authorizer: async ({ params, prisma }) => eventAuth.readStatistics.data(await readEventAccess(prisma, params.id)),
        operation: async ({ prisma, params }): Promise<VariantStatistics[]> => {
            const variants = await prisma.eventVariant.findMany({
                where: { eventId: params.id },
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    name: true,
                    registrationStart: true,
                    takesPayment: true,
                    quotas: { select: { places: true } },
                },
            })
            const registrations = await prisma.eventRegistration.findMany({
                where: {
                    OR: [
                        { quota: { variant: { eventId: params.id } } },
                        { waitingListVariant: { eventId: params.id } },
                    ],
                },
                orderBy: { createdAt: 'asc' },
                select: {
                    createdAt: true,
                    state: true,
                    attendedAt: true,
                    manuallyPaid: true,
                    waitingListVariantId: true,
                    quota: { select: { variantId: true } },
                    ledgerTransactions: { where: validTransactionFilter, select: { id: true }, take: 1 },
                },
            })

            return variants.map(variant => {
                const ofVariant = registrations.filter(registration => (
                    (registration.quota?.variantId ?? registration.waitingListVariantId) === variant.id
                ))
                const inQuota = ofVariant.filter(registration => registration.state === 'IN_QUOTA')
                return {
                    id: variant.id,
                    name: variant.name,
                    registrationStart: variant.registrationStart,
                    places: variant.quotas.reduce((sum, quota) => sum + quota.places, 0),
                    registeredAt: ofVariant.map(registration => registration.createdAt),
                    inQuota: inQuota.length,
                    lastSeatedAt: inQuota[inQuota.length - 1]?.createdAt ?? null,
                    waiting: ofVariant.length - inQuota.length,
                    paid: variant.takesPayment
                        ? inQuota.filter(registration => (
                            registration.manuallyPaid || registration.ledgerTransactions.length > 0
                        )).length
                        : null,
                    attended: inQuota.filter(registration => registration.attendedAt !== null).length,
                }
            })
        },
    }),


    create: defineOperation({
        dataSchema: eventSchemas.data.create,
        authorizer: () => eventAuth.create,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, data, session }) => {
            const eventStart = data.eventStart ?? new Date(Date.now() + UNSET_EVENT_TIME_OFFSET_MS)
            const eventEnd = data.eventEnd ?? eventStart
            if (eventStart > eventEnd) {
                throw new ServiceError('BAD PARAMETERS', 'Arrangementet må jo starte før det slutter')
            }
            if (data.takesPayment && !data.takesRegistration) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke ta betaling uten påmelding')
            }

            if (!data.visibilityAdminRequirements && !data.hostedByCommitteeId && !session?.user) {
                throw new ServiceError('BAD PARAMETERS', 'Velg hvem som arrangerer eller kan administrere arrangementet')
            }
            const adminRequirements = data.visibilityAdminRequirements
                ?? (data.hostedByCommitteeId
                    ? await hostCommitteeAdminRequirements(prisma, data.hostedByCommitteeId)
                    : NO_ADMINISTRATORS)

            // The event and everything it owns are created together, so a failure leaves no
            // orphaned paragraph, image, visibility, variant or quota behind.
            const cmsParagraph = await cmsParagraphOperations.create.internalCall({
                data: {},
                prisma,
                operationImplementationFields: { special: null }
            })
            const cmsImage = await cmsImageOperations.create.internalCall({
                data: {},
                prisma,
                operationImplementationFields: { special: null }
            })
            const visibilityAdmin = await visibilityOperations.createWithRequirements.internalCall({
                data: { requirements: adminRequirements },
                prisma,
            })
            const id = await reserveId(prisma, 'Event')
            const channels = await eventNotificationOperations.internal.createChannels.internalCall({
                prisma,
                params: { eventId: id },
                data: { name: data.name },
            })

            // Scalar foreign keys, since prisma will not take an explicit id along with nested connects.
            const createdEvent = await prisma.event.create({
                data: {
                    id,
                    name: data.name,
                    location: data.location,
                    locationMap: data.locationMap ? { create: getLocationMapData(data.locationMap) } : undefined,
                    eventStart,
                    eventEnd,
                    canBeViewedBy: data.canBeViewedBy ?? 'ALL',
                    hostedByCommitteeId: data.hostedByCommitteeId ?? undefined,
                    waitingList: data.waitingList ?? false,
                    bindingRegistration: data.bindingRegistration,
                    allowRegistrationInMultipleVariants: data.allowRegistrationInMultipleVariants,
                    createdById: session?.user?.id,
                    cmsParagraphId: cmsParagraph.id,
                    coverImageId: cmsImage.id,
                    visibilityAdminId: visibilityAdmin.id,
                    ...channels,
                }
            })
            await prisma.eventTagEvent.createMany({
                data: (data.tagIds ?? []).map(tagId => ({
                    eventId: createdEvent.id,
                    tagId
                }))
            })

            if (data.takesRegistration) {
                const variant = await createVariant(prisma, createdEvent.id, {
                    name: 'Påmelding',
                    registrationStart: data.registrationStart ?? new Date(),
                    registrationEnd: data.registrationEnd ?? new Date(Date.now() + DAY_MS),
                    takesPayment: data.takesPayment,
                    price: data.price,
                    paymentStart: data.paymentStart,
                    paymentEnd: data.paymentEnd,
                    requeueUnpaidRegistrations: data.requeueUnpaidRegistrations,
                })
                await createQuota(prisma, variant.id, {
                    name: 'Påmelding',
                    places: data.places ?? 0,
                    visibilityRequirements: data.quotaVisibilityRequirements,
                })
            }
            const event = createdEvent

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

    /**
     * Saves everything the form on the event's page holds, as one change: if any of it is refused,
     * none of it is saved. The event's own fields, its variants and quotas, who administrates it
     * and the account it is paid into may each be left out.
     */
    update: defineOperation({
        paramsSchema: eventSchemas.params.update,
        dataSchema: eventSchemas.data.update,
        authorizer: async ({ params, data, prisma }) => {
            const access = await readEventAccess(prisma, params.id)
            if (data.ledgerAccountSelection === undefined) return eventAuth.update.data(access)
            return eventAuth.connectToLedgerAccount.data({
                ...access,
                accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: data.ledgerAccountSelection })],
            })
        },
        transaction: 'OPENS',
        operation: async ({
            prisma,
            params,
            data: { tagIds, locationMap, notifyAboutChange, variants, adminRequirements, ledgerAccountSelection, ...data },
        }) => {
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

            if (ledgerAccountSelection !== undefined) await assertGroupAccount(prisma, ledgerAccountSelection)

            const { updatedEvent, promoted } = await prisma.$transaction(async tx => {
                await lockEvent(tx, params.id)
                const savedEvent = await tx.event.update({
                    where: { id: params.id },
                    data: {
                        ...data,
                        ledgerAccountId: ledgerAccountSelection,
                        locationMap: mapUpdate,
                    },
                })
                if (adminRequirements) {
                    await visibilityOperations.updateInTransaction.internalCall({
                        prisma: tx,
                        params: { visibilityId: event.visibilityAdminId },
                        data: { requirements: adminRequirements },
                    })
                }
                const promotedByChange = variants ? await applyRegistrationSetup(tx, params.id, variants) : []
                await assertSeenThroughQuotas(tx, params.id)
                if (data.name !== undefined && data.name !== event.name) {
                    await eventNotificationOperations.internal.renameChannels.internalCall({
                        prisma: tx,
                        params: { eventId: params.id },
                        data: { name: data.name },
                    })
                }
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
                if (data.hostedByCommitteeId) {
                    await adoptHostAsAdministrators(tx, params.id, event.visibilityAdminId, data.hostedByCommitteeId)
                }
                if (notifyAboutChange) {
                    await eventNotificationOperations.internal.createInfoNotification.internalCall({
                        prisma: tx,
                        params: { channelId: savedEvent.infoNotificationChannelId },
                        data: {
                            title: `Endring i ${savedEvent.name}`,
                            message: `${savedEvent.name} er endret. `
                                + `🕓 ${displayDate(savedEvent.eventStart)}, 📍 ${savedEvent.location}. `
                                + 'Se arrangementets side for detaljene.',
                            url: omegaEventLinks.event(savedEvent),
                            audience: { registeredForEventId: savedEvent.id },
                        },
                    })
                }
                return { updatedEvent: savedEvent, promoted: promotedByChange }
            })

            await notifyPromoted(prisma, params.id, promoted)
            return updatedEvent
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
            await assertGroupAccount(prisma, data.ledgerAccountId)

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
     * subscribers to the event's own channel about it, those of them who may register through one
     * of its quotas as the quotas are when the notification is sent.
     */
    setPublished: defineOperation({
        paramsSchema: eventSchemas.params.setPublished,
        dataSchema: eventSchemas.data.setPublished,
        authorizer: async ({ params, prisma }) => eventAuth.setPublished.data(await readEventAccess(prisma, params.id)),
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params, data }) => {
            if (data.published) {
                await assertSeenThroughQuotas(prisma, params.id, { published: true })
                await assertReadyToPublish(prisma, params.id)
            }
            const { count: flipped } = await prisma.event.updateMany({
                where: { id: params.id, published: !data.published },
                data: { published: data.published },
            })
            const event = await prisma.event.findUniqueOrThrow({ where: { id: params.id } })

            if (data.published && flipped) {
                await eventNotificationOperations.internal.createOwnNotification.internalCall({
                    params: { channelId: event.notificationChannelId },
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
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: {
                    visibilityAdminId: true,
                    notificationChannelId: true,
                    infoNotificationChannelId: true,
                    generalNotificationChannelId: true,
                    variants: { select: { quotas: { select: { visibilityId: true } } } },
                },
            })
            const registrationsOfEvent: Prisma.EventRegistrationWhereInput = {
                OR: [{ quota: { variant: { eventId: params.id } } }, { waitingListVariant: { eventId: params.id } }],
            }

            // The event lock comes first, as everywhere registrations move, so this cannot deadlock
            // with a move. The registrations are then locked as createPayment does, so no payment
            // can start between this check and the delete.
            await lockEvent(prisma, params.id)
            await prisma.$queryRaw`
                SELECT r."id" FROM "EventRegistration" r
                LEFT JOIN "EventQuota" q ON q."id" = r."quotaId"
                LEFT JOIN "EventVariant" v ON v."id" = COALESCE(q."variantId", r."waitingListVariantId")
                WHERE v."eventId" = ${params.id}
                FOR UPDATE OF r
            `
            const liveTransaction = await prisma.ledgerTransaction.findFirst({
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
            await prisma.eventRegistration.deleteMany({ where: registrationsOfEvent })
            await prisma.event.delete({
                where: {
                    id: params.id
                }
            })
            await eventNotificationOperations.internal.destroyChannels.internalCall({ prisma, params: event })
            const visibilityIds = [
                event.visibilityAdminId,
                ...event.variants.flatMap(variant => variant.quotas.map(quota => quota.visibilityId)),
            ]
            await Promise.all(visibilityIds.map(
                visibilityId => visibilityOperations.destroy.internalCall({ prisma, params: { visibilityId } })
            ))
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

/** The host committee's active members administrate the event, which stays right as the committee changes. */
async function hostCommitteeAdminRequirements(
    prisma: PrismaPossibleTransaction<false>,
    committeeId: number,
) {
    const { groupId } = await prisma.committee.findUniqueOrThrow({
        where: { id: committeeId },
        select: { groupId: true },
    })
    return [{ conditions: [{ type: 'ACTIVE' as const, groupId }] }]
}

async function assertReadyToPublish(prisma: PrismaPossibleTransaction<false>, eventId: number) {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
            location: true,
            eventStart: true,
            eventEnd: true,
            canBeViewedBy: true,
            ledgerAccount: { select: { id: true } },
            variants: {
                select: {
                    name: true,
                    registrationStart: true,
                    registrationEnd: true,
                    takesPayment: true,
                    price: true,
                    paymentStart: true,
                    paymentEnd: true,
                    quotas: { select: { places: true } },
                },
            },
        },
    })
    const access = await readEventAccess(prisma, eventId)
    const problems = publishProblems({ ...event, adminVisibility: access.adminVisibility })
    if (problems.length > 0) throw new ServiceError('BAD PARAMETERS', problems.join(' '))
}

/** A host chosen after the draft was created takes over, unless someone already administrates the event. */
async function adoptHostAsAdministrators(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    visibilityId: number,
    committeeId: number,
) {
    const access = await readEventAccess(prisma, eventId)
    if (!hasNoAdministrators(access.adminVisibility)) return
    await visibilityOperations.updateInTransaction.internalCall({
        prisma,
        params: { visibilityId },
        data: { requirements: await hostCommitteeAdminRequirements(prisma, committeeId) },
    })
}

async function assertGroupAccount(prisma: PrismaPossibleTransaction<false>, ledgerAccountId: number) {
    const account = await prisma.ledgerAccount.findUniqueOrThrow({
        where: { id: ledgerAccountId },
        select: { type: true },
    })
    if (account.type !== 'GROUP') {
        throw new ServiceError('BAD PARAMETERS', 'Et arrangement kan bare knyttes til en gruppekonto.')
    }
}
