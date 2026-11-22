import '@ow-server-only'
import { eventAuth, hasNoAdministrators } from './auth'
import { eventSchemas } from './schemas'
import {
    assertSeenThroughQuotas,
    linkedEventSeenBy,
    linksPresentation,
    readEventAccess,
    readLinkedEvent,
    setsCompany,
} from './access'
import { publishProblems } from './publishProblems'
import { lockEvent, registrationsOfEvent } from './registration/queue'
import { fixVariantPlaces, notifyPromoted } from './registration/fixState'
import { isToldOf, notifySlotChanges } from './registration/notifySlotChanges'
import {
    eventCompanySelection,
    eventListSelection,
    eventQuotaOrder,
    eventVariantOrder,
    eventLinkOmitted,
    eventVariantSummarySelection,
    linkableEventSelection,
} from './constants'
import { eventVariantOperations } from './variants/operations'
import { eventQuotaOperations } from './quotas/operations'
import { eventSlotOperations } from './slots/operations'
import { slotsOfSchedule } from './slots/schedule'
import { slotScheduleSelection } from './slots/constants'
import { eventNotificationOperations } from './notifications/operations'
import { eventKinds } from './kinds'
import { firstVariantSetup } from './firstSetup'
import { eventHomeLinks, eventLinks } from '@/pageKits/events/links'
import { eventHomePages } from '@/pageKits/events/homePages'
import { getLocationMapData } from '@/lib/maps/locationMap'
import { ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { displayDate } from '@/lib/dates/displayDate'
import { reserveId } from '@/lib/reserveId'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { availableNotificationMethodIncluder } from '@/services/notifications/channels/subservice/constants'
import { implementSearchOperation } from '@/services/search/implement'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { implementVisibilityRead, toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { PromotedRegistration } from './registration/fixState'
import type { VariantStatistics } from './statistics'
import type { SlotChange } from './slots/types'
import type { Event, EventKind, EventTag, Prisma } from '@/prisma-generated-pn-types'
import type { EventExpanded, LinkableEvent } from './types'
import type { SearchFindArgs } from '@/services/search/implement'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { SessionMaybeUser } from '@/auth/session/Session'

const DAY_MS = 1000 * 60 * 60 * 24

// A new event has no time yet, and the database requires one. Start and end both land here, at the
// same instant, which `hasNoTime` reads as no time. A week ahead keeps the draft on the list of
// coming events until someone sets them.
const UNSET_EVENT_TIME_OFFSET_MS = 7 * DAY_MS

// Administers nothing, so a draft from just a name is its creator's until someone is chosen.
const NO_ADMINISTRATORS = [{ conditions: [] }]

// Who administrates an event is changed with the event, by saving its setup.
const adminVisibility = implementVisibilityRead({
    implementationParamsSchema: eventSchemas.params.adminVisibility,
    authorizer: async ({ params, prisma }) => eventAuth.readAdminVisibility.data(
        await readEventAccess(prisma, params.id)
    ),
    readVisibility: async ({ prisma, implementationParams, include }) => (
        await prisma.event.findUniqueOrThrow({
            where: { id: implementationParams.id },
            select: { visibilityAdmin: { include } },
        })
    ).visibilityAdmin,
})

/** The event, which is not found when kinds are given and it is of none of them, as under pages that do not show it. */
const read = defineOperation({
    paramsSchema: eventSchemas.params.read,
    authorizer: async ({ params, prisma }) => eventAuth.read.data(await readEventAccess(prisma, params.id)),
    operation: async ({ prisma, params, session }) => {
        const {
            companyPresentationId,
            requiresPresentationSeat,
            speedInterview,
            ...event
        } = await prisma.event.findUniqueOrThrow({
            where: {
                id: params.id,
                kind: { in: params.kinds },
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
                company: eventCompanySelection,
                speedInterview: { select: { id: true } },
                ledgerAccount: { select: { id: true, name: true } },
                notificationChannel: { include: availableNotificationMethodIncluder },
                infoNotificationChannel: { include: availableNotificationMethodIncluder },
                generalNotificationChannel: { include: availableNotificationMethodIncluder },
                variants: {
                    select: {
                        ...eventVariantSummarySelection,
                        slotSchedule: { select: slotScheduleSelection },
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
        const companyPresentation = await linkedEventSeenBy(prisma, session, companyPresentationId)
        return {
            ...expanded,
            variants: expanded.variants.map(variant => ({
                ...variant,
                quotas: variant.quotas.map(({ visibility, ...quota }) => ({ ...quota, visibility: toMatrix(visibility) })),
            })),
            companyPresentation,
            // Said only to those who may see the presentation, the one it is in force for.
            requiresPresentationSeat: companyPresentation !== null && requiresPresentationSeat,
            speedInterview: await linkedEventSeenBy(prisma, session, speedInterview?.id ?? null),
            // For those who may publish it, as publishing would judge it. Null for anyone else.
            publishProblems: eventAuth.setPublished.data(await readEventAccess(prisma, params.id)).auth(session).authorized
                ? await publishProblemsOf(prisma, session, params.id)
                : null,
        }
    }
})

/**
 * Writes the event's own fields, taken as an authorized operation has parsed them. Both `update`
 * and `saveSetup` end here.
 */
const updateFields = defineSubOperation({
    paramsSchema: () => eventSchemas.params.updateFields,
    dataSchema: () => eventSchemas.data.updateFields,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data: { tagIds, locationMap, notifyAboutChange, ...data } }) => {
        const event = await prisma.event.findUniqueOrThrow({
            where: { id: params.id },
            include: { locationMap: true },
        })

        if ((data.eventStart ?? event.eventStart) > (data.eventEnd ?? event.eventEnd)) {
            throw new ServiceError('BAD PARAMETERS', 'Arrangementet må jo starte før det slutter')
        }
        if (typeof data.companyPresentationId === 'number' && data.companyPresentationId !== event.companyPresentationId) {
            // Under the presentation's lock, so that `destroy` sees every link to it once it holds that.
            await lockEvent(prisma, data.companyPresentationId)
            await assertLinkable(prisma, event.kind, data.companyPresentationId)
        }
        if (data.requiresPresentationSeat && !eventKinds[event.kind].linksTo) {
            throw new ServiceError('BAD PARAMETERS', 'Bare et speedintervju kan kreve plass på en bedriftspresentasjon.')
        }

        let mapUpdate: Prisma.EventLocationMapUpdateOneWithoutEventNestedInput | undefined
        if (locationMap) {
            const mapData = getLocationMapData(locationMap)
            mapUpdate = { upsert: { create: mapData, update: mapData } }
        } else if (locationMap === null && event.locationMap) {
            mapUpdate = { delete: true }
        }

        const updatedEvent = await prisma.event.update({
            where: { id: params.id },
            omit: eventLinkOmitted,
            data: {
                ...data,
                locationMap: mapUpdate,
                // Set here since prisma leaves it when no field of the event's own changes, and a
                // save of its variants or administrators alone is a save of the event too.
                updatedAt: new Date(),
            },
        })
        await assertSeenThroughQuotas(prisma, params.id)
        if (data.name !== undefined && data.name !== event.name) {
            await eventNotificationOperations.internal.renameChannels.internalCall({
                prisma,
                params: { eventId: params.id },
                data: { name: data.name },
            })
        }
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
        if (data.hostedByCommitteeId) {
            await adoptHostAsAdministrators(prisma, params.id, event.visibilityAdminId, data.hostedByCommitteeId)
        }
        if (notifyAboutChange) {
            await eventNotificationOperations.internal.createInfoNotification.internalCall({
                prisma,
                params: { channelId: updatedEvent.infoNotificationChannelId },
                data: { ...changeNotice(updatedEvent), audience: { registeredForEventId: updatedEvent.id } },
            })
        }
        return updatedEvent
    },
})

/** What those registered to an event are told when it is changed. */
function changeNotice(event: Pick<Event, 'id' | 'kind' | 'name' | 'eventStart' | 'location'>) {
    return {
        title: `Endring i ${event.name}`,
        message: `${event.name} er endret. 🕓 ${displayDate(event.eventStart)}, 📍 ${event.location}. `
            + 'Se arrangementets side for detaljene.',
        url: eventHomeLinks(event).event(event),
    }
}

/** Changes the event's own fields. Its variants, quotas, administrators and account have operations of their own. */
const update = defineOperation({
    paramsSchema: eventSchemas.params.update,
    dataSchema: eventSchemas.data.update,
    authorizer: async ({ params, data, prisma }) => eventAuth.update.data({
        ...await readEventAccess(prisma, params.id),
        setsCompany: await setsCompany(prisma, data.companyId, params.id),
    }),
    transaction: 'RUNS_IN',
    operation: ({ prisma, params, data }) => updateFields.internalCall({ prisma, params, data }),
})

/**
 * Links an event to the GROUP ledger account its registrations are paid into, replacing any
 * earlier link.
 */
const connectToLedgerAccount = defineOperation({
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
            omit: eventLinkOmitted,
            data: { ledgerAccountId: data.ledgerAccountId },
        })
    },
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

    /**
     * The events the event may be linked to: of the kind it links to, not ended, and with no other
     * event linked to them. Only those the session administrates, since linking takes that.
     */
    readLinkable: defineOperation({
        paramsSchema: eventSchemas.params.readLinkable,
        authorizer: () => eventAuth.readLinkable,
        operation: async ({ prisma, params }, prismaWhereFilter): Promise<LinkableEvent[]> => {
            const { kind } = await prisma.event.findUniqueOrThrow({ where: { id: params.id }, select: { kind: true } })
            const linksTo = eventKinds[kind].linksTo
            if (!linksTo) return []
            return await prisma.event.findMany({
                where: {
                    kind: linksTo,
                    eventEnd: { gte: new Date() },
                    AND: [
                        { OR: [{ speedInterview: { is: null } }, { speedInterview: { id: params.id } }] },
                        prismaWhereFilter ?? {},
                    ],
                },
                orderBy: [{ eventStart: 'asc' }, { id: 'asc' }],
                select: linkableEventSelection,
            })
        },
    }),

    create: defineOperation({
        dataSchema: eventSchemas.data.create,
        authorizer: async ({ data, prisma }) => eventAuth.create.data({
            setsCompany: await setsCompany(prisma, data.companyId),
        }),
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
            const visibilityAdmin = await adminVisibility.internal.create.internalCall({
                data: { requirements: adminRequirements },
                prisma,
            })
            const id = await reserveId(prisma, 'Event')
            const channels = await eventNotificationOperations.internal.createChannels.internalCall({
                prisma,
                params: { eventId: id },
                data: { name: data.name, kind: data.kind },
            })

            // Scalar foreign keys, since prisma will not take an explicit id along with nested connects.
            const createdEvent = await prisma.event.create({
                data: {
                    id,
                    kind: data.kind,
                    name: data.name,
                    location: data.location,
                    locationMap: data.locationMap ? { create: getLocationMapData(data.locationMap) } : undefined,
                    eventStart,
                    eventEnd,
                    canBeViewedBy: data.canBeViewedBy ?? 'ALL',
                    hostedByCommitteeId: data.hostedByCommitteeId ?? undefined,
                    companyId: data.companyId ?? undefined,
                    waitingList: data.waitingList ?? false,
                    bindingRegistration: data.bindingRegistration ?? eventKinds[data.kind].firstSetup.bindingRegistration,
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
                const ofKind = firstVariantSetup(data.kind, { eventStart, eventEnd })
                const { slotSchedule } = ofKind
                const schedule = slotSchedule?.start ? { ...slotSchedule, start: slotSchedule.start } : null
                if (slotSchedule && !schedule) {
                    throw new ServiceError(
                        'BAD PARAMETERS',
                        'Sett når arrangementet er før det tar påmelding, så tidslukene kan legges etter det.'
                    )
                }
                const variant = await eventVariantOperations.internal.create.internalCall({
                    prisma,
                    params: { eventId: createdEvent.id },
                    data: {
                        name: 'Påmelding',
                        registrationType: ofKind.registrationType,
                        registrationStart: data.registrationStart
                            ?? ofKind.registrationPeriod?.registrationStart
                            ?? new Date(),
                        registrationEnd: data.registrationEnd
                            ?? ofKind.registrationPeriod?.registrationEnd
                            ?? new Date(Date.now() + DAY_MS),
                        takesPayment: data.takesPayment,
                        price: data.price,
                        paymentStart: data.paymentStart,
                        paymentEnd: data.paymentEnd,
                        requeueUnpaidRegistrations: data.requeueUnpaidRegistrations,
                    },
                })
                await eventQuotaOperations.internal.create.internalCall({
                    prisma,
                    params: { variantId: variant.id },
                    data: {
                        name: 'Påmelding',
                        places: data.places ?? (schedule ? slotsOfSchedule(schedule).length : 0),
                        visibilityRequirements: data.quotaVisibilityRequirements,
                    },
                })
                await eventSlotOperations.internal.saveSchedule.internalCall({
                    prisma,
                    params: { variantId: variant.id },
                    data: { schedule },
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
                    kind: { in: params.kinds },
                    companyId: params.companyId,
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
                    kind: { in: params.paging.details.kinds },
                    companyId: params.paging.details.companyId,
                    ...prismaWhereFilter
                },
                orderBy: [{ eventStart: 'desc' }, { id: 'desc' }],
                select: eventListSelection,
            })
            return events.map(withTagsAndVariantSummary)
        }
    }),

    /**
     * The search for the event pages of a site, of which it may have several: the events of the kinds
     * they show, each linked to on the pages among them that show its kind. Past and coming events are
     * searched, the most recent first, and only those the session may see, by the rule of the lists above.
     */
    search: implementSearchOperation({
        authorizer: () => eventAuth.search,
        find: ({
            prisma, query, take, prismaWhereFilter, config
        }: SearchFindArgs<Prisma.EventWhereInput, EventPagesConfig[]>) => prisma.event.findMany({
            take,
            select: {
                id: true,
                kind: true,
                name: true,
                eventStart: true,
                company: { select: { name: true } },
                coverImage: {
                    select: {
                        image: { include: expandedImageIncluder }
                    }
                }
            },
            where: {
                kind: { in: config.flatMap(pages => pages.kindsToShow) },
                // The visibility filter is an OR of its own, so the two are joined rather than spread together.
                AND: [
                    {
                        OR: [
                            { name: { contains: query, mode: 'insensitive' } },
                            { company: { name: { contains: query, mode: 'insensitive' } } },
                        ],
                    },
                    prismaWhereFilter ?? {},
                ],
            },
            orderBy: { eventStart: 'desc' },
        }),
        toSearchResult: (event, config) => ({
            key: `event-${event.id}`,
            href: eventLinks(
                config.find(pages => pages.kindsToShow.includes(event.kind)) ?? eventHomePages[event.kind]
            ).event(event),
            label: event.name,
            sublabel: [
                new Set(config.flatMap(pages => pages.kindsToShow)).size > 1 ? eventKinds[event.kind].name : null,
                event.company?.name ?? null,
                displayDate(event.eventStart, false),
            ].filter(part => part !== null).join(', '),
            image: event.coverImage.image,
        }),
    }),

    update,

    /**
     * Saves everything the form on the event's page holds, as one change: if any of it is refused,
     * none of it is saved. The event's own fields, its variants and quotas, who administrates it
     * and the account it is paid into may each be left out. Each part is saved by the operation
     * that owns it. This one holds them together in one transaction.
     *
     * Those whose slot a new schedule changes are told of it each, once. When the change is to be
     * told to everyone registered too, they are told of it with their slot and the rest apart.
     */
    saveSetup: defineOperation({
        paramsSchema: eventSchemas.params.saveSetup,
        dataSchema: eventSchemas.data.saveSetup,
        authorizer: async ({ params, data, prisma }) => eventAuth.saveSetup.data({
            ...await readEventAccess(prisma, params.id),
            setsCompany: await setsCompany(prisma, data.companyId, params.id),
            linksPresentation: await linksPresentation(prisma, data.companyPresentationId),
        }),
        transaction: 'OPENS',
        operation: async ({
            prisma,
            params,
            data: { variants, adminRequirements, ledgerAccountSelection, basedOnUpdatedAt, notifyAboutChange, ...fields },
        }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.id },
                select: { visibilityAdminId: true, ledgerAccountId: true },
            })

            const { savedEvent, promoted, toldOfSlot } = await prisma.$transaction(async tx => {
                await lockEvent(tx, params.id)
                if (basedOnUpdatedAt) await assertNotSavedSince(tx, params.id, basedOnUpdatedAt)
                // Linking takes access to the account, which the operation checks itself. It goes
                // first, so that it is judged by who administrates the event before this save.
                if (ledgerAccountSelection !== undefined && ledgerAccountSelection !== event.ledgerAccountId) {
                    await connectToLedgerAccount({
                        prisma: tx,
                        params,
                        data: { ledgerAccountId: ledgerAccountSelection },
                    })
                }
                if (adminRequirements) {
                    await adminVisibility.internal.update.internalCall({
                        prisma: tx,
                        params: { visibilityId: event.visibilityAdminId },
                        data: { requirements: adminRequirements },
                    })
                }
                const { variantIds, slotChanges } = variants
                    ? await eventVariantOperations.internal.saveSetup.internalCall({
                        prisma: tx,
                        params: { eventId: params.id },
                        data: { variants },
                    })
                    : { variantIds: [], slotChanges: [] }
                const changesToTell = slotChanges.filter(isToldOf)
                const usersToldOfSlot = changesToTell.flatMap(change => (change.userId === null ? [] : [change.userId]))
                // The event's own fields go last, since they are checked against its quotas as the save leaves them.
                const saved = await updateFields.internalCall({
                    prisma: tx,
                    params,
                    data: { ...fields, notifyAboutChange: notifyAboutChange && usersToldOfSlot.length === 0 },
                })
                if (notifyAboutChange && usersToldOfSlot.length > 0) {
                    await notifyOthersOfChange(tx, saved, usersToldOfSlot)
                }

                const promotedBySave: PromotedRegistration[] = []
                for (const variantId of variantIds) promotedBySave.push(...await fixVariantPlaces(tx, variantId))
                await assertPlacingKept(tx, slotChanges)
                return { savedEvent: saved, promoted: promotedBySave, toldOfSlot: changesToTell }
            })

            await notifyPromoted(prisma, params.id, promoted)
            await notifySlotChanges(
                prisma,
                params.id,
                toldOfSlot,
                notifyAboutChange ? changeNotice(savedEvent).message : null,
            )
            return savedEvent
        }
    }),

    connectToLedgerAccount,

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
        operation: async ({ prisma, params, data, session }) => {
            if (data.published) {
                await assertSeenThroughQuotas(prisma, params.id, { published: true })
                const problems = await publishProblemsOf(prisma, session, params.id)
                if (problems.length > 0) throw new ServiceError('BAD PARAMETERS', problems.join(' '))
            }
            const { count: flipped } = await prisma.event.updateMany({
                where: { id: params.id, published: !data.published },
                data: { published: data.published },
            })
            const event = await prisma.event.findUniqueOrThrow({ where: { id: params.id }, omit: eventLinkOmitted })

            if (data.published && flipped) {
                await eventNotificationOperations.internal.createOwnNotification.internalCall({
                    params: { channelId: event.notificationChannelId },
                    data: {
                        title: `Hvad der hender: ${event.name}`,
                        message: `${event.name}, 🕓 ${displayDate(event.eventStart, false)},📍 ${event.location}`,
                        url: eventHomeLinks(event).event(event),
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
        transaction: 'OPENS',
        operation: async ({ prisma, params }) => {
            const speedInterview = await prisma.$transaction(tx => destroyEvent(tx, params.id))
            if (speedInterview) await notifyPromoted(prisma, speedInterview.id, speedInterview.promoted)
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

/**
 * Deletes the event with all it owns. A presentation lets go of its speed interview first, which
 * comes back with those it seated.
 */
async function destroyEvent(prisma: Prisma.TransactionClient, eventId: number) {
    const speedInterview = await letGoOfSpeedInterview(prisma, eventId)
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
            visibilityAdminId: true,
            notificationChannelId: true,
            infoNotificationChannelId: true,
            generalNotificationChannelId: true,
            variants: { select: { quotas: { select: { visibilityId: true } } } },
        },
    })
    const registrations = registrationsOfEvent(eventId)

    // The event lock comes before the registrations', as everywhere registrations move, so this
    // cannot deadlock with a move. The registrations are then locked as createPayment does, so no
    // payment can start between this check and the delete. Linking takes this lock too, so no
    // speed interview is linked to the event from here on, and one linked since it let go of its
    // own is refused, since this lock may not come before a speed interview's.
    await lockEvent(prisma, eventId)
    if (await prisma.event.count({ where: { companyPresentationId: eventId } }) > 0) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Et speedintervju ble koblet til bedriftspresentasjonen i det samme. Prøv igjen.'
        )
    }
    await prisma.$queryRaw`
        SELECT r."id" FROM "EventRegistration" r
        LEFT JOIN "EventQuota" q ON q."id" = r."quotaId"
        LEFT JOIN "EventVariant" v ON v."id" = COALESCE(q."variantId", r."waitingListVariantId")
        WHERE v."eventId" = ${eventId}
        FOR UPDATE OF r
    `
    const liveTransaction = await prisma.ledgerTransaction.findFirst({
        where: {
            eventRegistration: registrations,
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
    await prisma.eventRegistration.deleteMany({ where: registrations })
    await prisma.event.delete({
        where: {
            id: eventId
        }
    })
    await eventNotificationOperations.internal.destroyChannels.internalCall({ prisma, params: event })
    await adminVisibility.internal.destroy.internalCall({
        prisma,
        params: { visibilityId: event.visibilityAdminId },
    })
    await Promise.all(event.variants.flatMap(variant => variant.quotas.map(
        quota => eventQuotaOperations.visibility.internal.destroy.internalCall({
            prisma,
            params: { visibilityId: quota.visibilityId },
        })
    )))
    return speedInterview
}

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
    return [{ conditions: [{ groupId, order: null, onlyActive: true, onlyAdmins: false }] }]
}

/**
 * What `publishProblems` finds missing in the event as it is saved, for publishing it and for the
 * page that offers to. A presentation the session may not see is checked too, as one hidden, so that
 * they say nothing of it but that it is not ready.
 */
async function publishProblemsOf(prisma: PrismaPossibleTransaction<false>, session: SessionMaybeUser, eventId: number) {
    const { companyPresentationId, ...event } = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
            companyPresentationId: true,
            requiresPresentationSeat: true,
            location: true,
            eventStart: true,
            eventEnd: true,
            canBeViewedBy: true,
            ledgerAccount: { select: { id: true } },
            variants: {
                select: {
                    name: true,
                    registrationType: true,
                    slotSchedule: { select: slotScheduleSelection },
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
    const seen = await linkedEventSeenBy(prisma, session, companyPresentationId)
    return publishProblems({
        ...event,
        adminVisibility: access.adminVisibility,
        companyPresentation: seen ?? (companyPresentationId === null
            ? null
            : { ...await readLinkedEvent(prisma, companyPresentationId), hidden: true }),
    })
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
    await adminVisibility.internal.update.internalCall({
        prisma,
        params: { visibilityId },
        data: { requirements: await hostCommitteeAdminRequirements(prisma, committeeId) },
    })
}

/**
 * Tells those registered to the event that it is changed, but for the users given, who are told
 * with their slot. An empty list of users would mean no restriction, so no one is told then.
 */
async function notifyOthersOfChange(
    prisma: Prisma.TransactionClient,
    event: Pick<Event, 'id' | 'kind' | 'name' | 'eventStart' | 'location' | 'infoNotificationChannelId'>,
    exceptUserIds: number[],
) {
    const others = await prisma.eventRegistration.findMany({
        where: { ...registrationsOfEvent(event.id), userId: { not: null, notIn: exceptUserIds } },
        select: { userId: true },
        distinct: ['userId'],
    })
    const userIds = others.flatMap(registration => (registration.userId === null ? [] : [registration.userId]))
    if (userIds.length === 0) return
    await eventNotificationOperations.internal.createInfoNotification.internalCall({
        prisma,
        params: { channelId: event.infoNotificationChannelId },
        data: { ...changeNotice(event), audience: { userIds, registeredForEventId: event.id } },
    })
}

/**
 * Refuses a placing of those who held a slot that the places of the quotas did not let stand:
 * `fixVariantPlaces` gave one sent to the waiting list a place again, or gave someone placed
 * another slot, or none, or seated them in another variant, which took them off this one.
 */
async function assertPlacingKept(prisma: Prisma.TransactionClient, changes: SlotChange[]) {
    for (const change of changes.filter(placed => !placed.removed)) {
        const registration = await prisma.eventRegistration.findUnique({
            where: { id: change.registrationId },
            select: { slot: { select: { start: true } } },
        })
        if (!registration) {
            throw new ServiceError(
                'BAD PARAMETERS',
                'Noen som er plassert, fikk plass i en annen variant og står ikke lenger her. Plasser dem på nytt.'
            )
        }
        if (registration.slot?.start.getTime() === change.after?.start.getTime()) continue
        throw new ServiceError('BAD PARAMETERS', change.after
            ? 'Kvotene har ikke plass til alle slik de er plassert. Endre plassene i kvotene, eller plasser dem på nytt.'
            : 'Noen er satt på ventelisten, men har en ledig plass i en tidsluke. Plasser dem der.')
    }
}

/**
 * Refuses a save filled in from the event as it was before someone else saved it. Run it under
 * `lockEvent`, so that two saves from the same state cannot both pass.
 */
async function assertNotSavedSince(prisma: PrismaPossibleTransaction<false>, eventId: number, basedOnUpdatedAt: Date) {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { updatedAt: true } })
    if (event.updatedAt.getTime() !== basedOnUpdatedAt.getTime()) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Arrangementet er lagret etter at skjemaet ble lastet. Last inn siden på nytt før du lagrer, '
            + 'så ingenting av det som er lagret går tapt.'
        )
    }
}

const secondLinkRefusal = 'Bedriftspresentasjonen har allerede et speedintervju.'

/**
 * Refuses a link but from an event of a kind that links to another, to an event of that kind, and
 * to one that has an event linked to it already.
 */
async function assertLinkable(prisma: PrismaPossibleTransaction<false>, kind: EventKind, linkedId: number) {
    const linked = await prisma.event.findUniqueOrThrow({
        where: { id: linkedId },
        select: { kind: true, speedInterview: { select: { id: true } } },
    })
    if (eventKinds[kind].linksTo !== linked.kind) {
        throw new ServiceError('BAD PARAMETERS', 'Bare et speedintervju kobles til en bedriftspresentasjon.')
    }
    if (linked.speedInterview) throw new ServiceError('DUPLICATE', secondLinkRefusal)
}

/**
 * Clears the link of a speed interview to the presentation being deleted, and fixes its places,
 * since those who waited for want of a seat on it may take one now. It takes the speed interview's
 * lock, so it runs before the presentation's is taken.
 */
async function letGoOfSpeedInterview(tx: Prisma.TransactionClient, presentationId: number) {
    const speedInterview = await tx.event.findUnique({
        where: { companyPresentationId: presentationId },
        select: { id: true },
    })
    if (!speedInterview) return null
    await lockEvent(tx, speedInterview.id)
    await tx.event.updateMany({
        where: { id: speedInterview.id, companyPresentationId: presentationId },
        data: { companyPresentationId: null },
    })
    const variants = await tx.eventVariant.findMany({ where: { eventId: speedInterview.id }, select: { id: true } })
    const promoted: PromotedRegistration[] = []
    for (const variant of variants) promoted.push(...await fixVariantPlaces(tx, variant.id))
    return { id: speedInterview.id, promoted }
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
