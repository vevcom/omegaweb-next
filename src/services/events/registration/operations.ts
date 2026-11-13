import '@pn-server-only'
import {
    eventRegistrationAttendanceSelection,
    eventRegistrationNotAttendedSelection,
    eventRegistrationSelectionDetailed,
    eventRegistrationQueueOrder,
    eventRegistrationSelection,
    maxDotsForNotShowingUp,
    REGISTRATION_READER_TYPE,
    upcomingRegistrationOfUserSelection,
} from './constants'
import { eventRegistrationAuth } from './auth'
import { eventRegistrationSchemas } from './schemas'
import { fixVariantPlaces, leaveOtherWaitingLists, notifyPromoted } from './fixState'
import { withPaymentDeadline } from './paymentDeadline'
import {
    lockEvent,
    queuedAhead,
    queuedBehind,
    queueSegmentFilter,
    queueSegmentOrder,
    registrationsOfEvent,
    registrationsOfVariant,
    seatedInEvent,
    untieQueue,
    waitingInEvent,
    waitingInVariant,
} from './queue'
import { dotOperations } from '@/services/dots/operations'
import { displayDate } from '@/lib/dates/displayDate'
import { Smorekopp } from '@/services/error'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { readEventAccess } from '@/services/events/access'
import { eventQuotaOrder, eventVariantOrder } from '@/services/events/constants'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import { defineOperation, defineSubOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { MembershipFiltered } from '@/services/groups/types'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type {
    DotPunishment,
    EventAttendanceCounts,
    EventAttendanceRegistration,
    EventAttendanceScan,
    EventRegistrationExpanded,
    EventRegistrationNotAttended,
    EventRegistrationOfUser,
    UpcomingRegistrationOfUser,
} from './types'

const readDotPunishmentOfUser = defineOperation({
    paramsSchema: eventRegistrationSchemas.params.readDotPunishmentOfUser,
    authorizer: ({ params }) => eventRegistrationAuth.readDotPunishmentOfUser.data({ userId: params.userId }),
    operation: async ({ prisma, params }): Promise<DotPunishment> => {
        const dots = await dotOperations.internal.numberOfActiveDotsForUser.internalCall({
            params,
            prisma,
        })

        if (dots >= 5) return { type: 'ban' }
        if (dots >= 4) return { type: 'timeout', punishmentMinutes: 24 * 60 }
        if (dots >= 3) return { type: 'timeout', punishmentMinutes: 3 * 60 }
        if (dots >= 2) return { type: 'timeout', punishmentMinutes: 10 }
        return { type: 'none' }
    }
})

// Spelled out as a union: inferred, the conditional would reduce it to the plain schema, as the
// one with the quota is assignable to it, and the quota would be lost to the types.
type CreateParamsSchema =
    | typeof eventRegistrationSchemas.params.create
    | typeof eventRegistrationSchemas.params.createAsAdmin

/**
 * Registers a user to a variant of an event. A user registers themselves within the registration
 * period and held back by their dots; an administrator registers anyone, at any time, into the
 * quota they name. Either way the registration joins the waiting list and `fixVariantPlaces`
 * seats it if a place is free, so no one passes those already waiting.
 */
const createRegistration = defineSubOperation({
    paramsSchema: ({ asAdmin }: { asAdmin: boolean }): CreateParamsSchema => (asAdmin
        ? eventRegistrationSchemas.params.createAsAdmin
        : eventRegistrationSchemas.params.create),
    transaction: 'OPENS',
    operation: ({ asAdmin }: { asAdmin: boolean }) =>
        async ({ prisma, params, session }) => {
            const { registration, promoted } = await prisma.$transaction(async tx => {
                await lockEvent(tx, params.eventId)
                const variant = await resolveVariant(tx, params.eventId, params.variantId)
                await assertMayJoin(tx, variant, params.userId)
                const pickedQuotaId = 'quotaId' in params && typeof params.quotaId === 'number' ? params.quotaId : null
                if (!asAdmin) assertOpenForUser(variant, session.memberships, await delayOf(tx, params.userId))
                const placed = asAdmin
                    ? await placeAsAdmin(tx, variant, { userId: params.userId }, pickedQuotaId)
                    : await joinVariant(tx, variant, { userId: params.userId })
                await eventNotificationOperations.internal.subscribeToInfoChannel.internalCall({
                    prisma: tx,
                    params: { eventId: params.eventId, userId: params.userId },
                })
                return placed
            })

            await notifyPromoted(prisma, params.eventId, promoted)
            return registration
        },
})

/**
 * Unregisters, and lets `fixVariantPlaces` give the freed place on. A user unregisters within the
 * registration period of the variant and never from a binding registration; an administrator
 * removes any registration at any time.
 */
const destroyRegistration = defineSubOperation({
    paramsSchema: () => eventRegistrationSchemas.params.destroy,
    transaction: 'OPENS',
    operation: ({ asAdmin }: { asAdmin: boolean }) =>
        async ({ prisma, params }) => {
            const { eventId, variantId } = await registrationContext(prisma, params.registrationId)

            const promoted = await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                // createPayment holds this row lock, not the event's, so a payment started for the
                // registration is either seen below or finds the registration gone.
                await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${params.registrationId} FOR UPDATE`
                const registration = await tx.eventRegistration.findUniqueOrThrow({
                    where: { id: params.registrationId },
                    select: { id: true, userId: true, state: true },
                })
                const [event, variant] = await Promise.all([
                    tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { bindingRegistration: true } }),
                    tx.eventVariant.findUniqueOrThrow({ where: { id: variantId }, select: { registrationEnd: true } }),
                ])

                if (!asAdmin) {
                    if (event.bindingRegistration) {
                        throw new Smorekopp(
                            'BAD PARAMETERS',
                            'Påmeldingen er bindende. Ta kontakt med arrangørene om du ikke kan komme.'
                        )
                    }
                    if (registration.state === 'IN_QUOTA' && variant.registrationEnd < new Date()) {
                        throw new Smorekopp(
                            'BAD PARAMETERS',
                            'Du kan ikke melde deg av etter påmeldingsfristen. Ta kontakt med arrangørene.'
                        )
                    }
                }

                // A still-processing attempt (e.g. Stripe checkout open in another tab) needs
                // handling too, not just an already-SUCCEEDED one.
                const liveTransaction = await tx.ledgerTransaction.findFirst({
                    where: {
                        eventRegistrationId: params.registrationId,
                        OR: [{ state: 'PENDING' }, validTransactionFilter],
                    },
                    select: { id: true, state: true },
                })
                if (liveTransaction && registration.userId) {
                    const payerAccount = await ledgerAccountOperations.read({
                        params: { userId: registration.userId },
                        bypassAuth: true,
                        prisma: tx,
                    })

                    if (liveTransaction.state === 'SUCCEEDED') {
                        await refundOperations.reverseTransaction({
                            params: {
                                originalTransactionId: liveTransaction.id,
                                reason: 'Avregistrert fra betalt arrangement.',
                                refundTo: payerAccount.id,
                            },
                            prisma: tx,
                            bypassAuth: true,
                        })
                    } else {
                        // Canceled so a late webhook can't complete it. If the payment succeeds at that
                        // very moment, the cancel fails, and unregistering again reverses it instead.
                        await ledgerTransactionOperations.cancel({
                            params: { id: liveTransaction.id },
                            prisma: tx,
                            bypassAuth: true,
                        })
                    }
                }

                await tx.eventRegistration.delete({ where: { id: params.registrationId } })
                return await fixVariantPlaces(tx, variantId)
            })

            await notifyPromoted(prisma, eventId, promoted)
        },
})

export const eventRegistrationOperations = {
    create: createRegistration.implement({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.create.data({
            userId: params.userId,
            ...await readEventAccess(prisma, params.eventId),
        }),
        ownershipCheck: () => true,
        paramsSchemaImplementationFields: { asAdmin: false },
        operationImplementationFields: { asAdmin: false },
    }),

    createAsAdmin: createRegistration.implement({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.createAsAdmin.data(
            await readEventAccess(prisma, params.eventId)
        ),
        ownershipCheck: () => true,
        paramsSchemaImplementationFields: { asAdmin: true },
        operationImplementationFields: { asAdmin: true },
    }),

    createGuest: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.createGuest.data(
            await readEventAccess(prisma, params.eventId)
        ),
        paramsSchema: eventRegistrationSchemas.params.createGuest,
        dataSchema: eventRegistrationSchemas.data.createGuest,
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) => {
            const { registration, promoted } = await prisma.$transaction(async tx => {
                await lockEvent(tx, params.eventId)
                const variant = await resolveVariant(tx, params.eventId, params.variantId)
                const contact = await tx.contactDetails.create({ data: { name: data.name } })
                return await placeAsAdmin(tx, variant, { contactId: contact.id, note: data.note }, params.quotaId ?? null)
            })

            await notifyPromoted(prisma, params.eventId, promoted)
            return registration
        },
    }),

    readDotPunishmentOfUser,

    /** The registration of a user in a variant of an event, or null. */
    readOfUser: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readOfUser({
            userId: params.userId,
            access: await readEventAccess(prisma, params.eventId),
        }),
        paramsSchema: eventRegistrationSchemas.params.readOfUser,
        operation: async ({ prisma, params }): Promise<EventRegistrationOfUser | null> => {
            const variant = await resolveVariant(prisma, params.eventId, params.variantId)
            const registration = await prisma.eventRegistration.findFirst({
                where: { userId: params.userId, ...registrationsOfVariant(variant.id) },
                include: {
                    quota: { select: { id: true, name: true, variantId: true } },
                    // Only need to know whether a payment exists and is still in effect, to gate
                    // the "pay for registration" UI once it's already been paid for.
                    ledgerTransactions: {
                        where: validTransactionFilter,
                        select: { id: true },
                    },
                },
            })
            return registration && { ...withPaymentDeadline(registration, variant), variantId: variant.id }
        },
    }),

    /**
     * The registrations of a user for events that have not ended, soonest first. Given a special tag,
     * only those for events carrying it.
     */
    readUpcomingOfUser: defineOperation({
        authorizer: ({ params }) => eventRegistrationAuth.readUpcomingOfUser.data({ userId: params.userId }),
        paramsSchema: eventRegistrationSchemas.params.readUpcomingOfUser,
        operation: async ({ prisma, params }): Promise<UpcomingRegistrationOfUser[]> => {
            const event: Prisma.EventWhereInput = {
                eventEnd: { gte: new Date() },
                ...(params.specialTag && {
                    eventTagEvents: { some: { tag: { special: params.specialTag } } },
                }),
            }
            const registrations = await prisma.eventRegistration.findMany({
                where: {
                    userId: params.userId,
                    OR: [{ quota: { variant: { event } } }, { waitingListVariant: { event } }],
                },
                select: upcomingRegistrationOfUserSelection,
            })
            return registrations.map(registration => {
                const variant = registration.quota?.variant ?? registration.waitingListVariant
                if (!variant) {
                    throw new Smorekopp('SERVER ERROR', 'Påmeldingen hører verken til en kvote eller en venteliste.')
                }
                return {
                    id: registration.id,
                    onWaitingList: registration.state === 'WAITING_LIST',
                    variant: { id: variant.id, name: variant.name },
                    event: variant.event,
                }
            }).sort((left, right) => left.event.eventStart.getTime() - right.event.eventStart.getTime())
        },
    }),

    readPage: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readPage.data(
            await readEventAccess(prisma, params.paging.details.eventId)
        ),
        paramsSchema: eventRegistrationSchemas.params.readPage,
        operation: async ({ prisma, params }): Promise<EventRegistrationExpanded[]> => {
            const defaultImage = await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_PROFILE_IMAGE' },
            })

            const registrations = await prisma.eventRegistration.findMany({
                ...cursorPagingSelection(params.paging.page),
                where: queueSegmentFilter(params.paging.details),
                orderBy: queueSegmentOrder(params.paging.details.type),
                select: eventRegistrationSelection,
            })

            return registrations.map(registration => ({
                ...registration,
                image: registration.user?.image ?? defaultImage,
            }))
        },
    }),

    readPageDetailed: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readPageDetailed.data(
            await readEventAccess(prisma, params.paging.details.eventId)
        ),
        paramsSchema: eventRegistrationSchemas.params.readPageDetailed,
        operation: async ({ prisma, params }) => await prisma.eventRegistration.findMany({
            ...cursorPagingSelection(params.paging.page),
            where: queueSegmentFilter(params.paging.details),
            orderBy: queueSegmentOrder(params.paging.details.type),
            select: eventRegistrationSelectionDetailed,
        }),
    }),

    updateNotes: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.updateNotes(
            await registrationOwnerAndAccess(prisma, params.registrationId)
        ),
        paramsSchema: eventRegistrationSchemas.params.updateNotes,
        dataSchema: eventRegistrationSchemas.data.updateNotes,
        operation: async ({ prisma, params, data }) => {
            const { variantId } = await registrationContext(prisma, params.registrationId)
            const variant = await prisma.eventVariant.findUniqueOrThrow({
                where: { id: variantId },
                select: { registrationEnd: true },
            })
            if (variant.registrationEnd < new Date()) {
                throw new Smorekopp('BAD PARAMETERS', 'Kan ikke endre påmelding etter påmeldingsfristen.')
            }

            return await prisma.eventRegistration.update({
                where: { id: params.registrationId },
                data: { note: data.note },
            })
        }
    }),

    destroy: destroyRegistration.implement({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.destroy(
            await prisma.eventRegistration.findUniqueOrThrow({
                where: { id: params.registrationId },
                select: { userId: true },
            })
        ),
        ownershipCheck: () => true,
        operationImplementationFields: { asAdmin: false },
    }),

    destroyAsAdmin: destroyRegistration.implement({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.destroyAsAdmin.data(
            (await registrationOwnerAndAccess(prisma, params.registrationId)).access
        ),
        ownershipCheck: () => true,
        operationImplementationFields: { asAdmin: true },
    }),

    /** Moves a registration one step up or down the waiting list of its variant by trading queue times. */
    move: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.move.data(
            (await registrationOwnerAndAccess(prisma, params.registrationId)).access
        ),
        paramsSchema: eventRegistrationSchemas.params.move,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params }) => {
            const { eventId, variantId } = await registrationContext(prisma, params.registrationId)

            await lockEvent(prisma, eventId)
            const registration = await prisma.eventRegistration.findUniqueOrThrow({
                where: { id: params.registrationId },
                select: { id: true, queuedAt: true, state: true },
            })
            if (registration.state !== 'WAITING_LIST') {
                throw new Smorekopp('BAD PARAMETERS', 'Bare ventelisten har en kø å flytte i.')
            }
            const up = params.direction === 'UP'

            const neighbour = await prisma.eventRegistration.findFirst({
                where: {
                    ...waitingInVariant(variantId),
                    ...(up ? queuedAhead(registration) : queuedBehind(registration)),
                },
                orderBy: up
                    ? [{ queuedAt: 'desc' }, { id: 'desc' }]
                    : eventRegistrationQueueOrder,
                select: { id: true, queuedAt: true },
            })
            if (!neighbour) {
                throw new Smorekopp(
                    'BAD PARAMETERS',
                    up ? 'Påmeldingen er allerede først i køen.' : 'Påmeldingen er allerede sist i køen.'
                )
            }

            const ahead = up ? neighbour : registration
            const behind = up ? registration : neighbour
            // On equal times the id decides, so trading them would change nothing.
            const times = ahead.queuedAt.getTime() === behind.queuedAt.getTime()
                ? await untieQueue(prisma, variantId)
                : new Map([[ahead.id, ahead.queuedAt], [behind.id, behind.queuedAt]])
            await prisma.eventRegistration.update({ where: { id: behind.id }, data: { queuedAt: times.get(ahead.id) } })
            await prisma.eventRegistration.update({ where: { id: ahead.id }, data: { queuedAt: times.get(behind.id) } })
        },
    }),

    /**
     * Gives a registration a place in a quota of its variant, from the waiting list or from another
     * quota, and lets `fixVariantPlaces` fill what it left. The administrator is held to the
     * quota's places, not its visibility.
     */
    moveToQuota: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.moveToQuota.data(
            (await registrationOwnerAndAccess(prisma, params.registrationId)).access
        ),
        paramsSchema: eventRegistrationSchemas.params.moveToQuota,
        dataSchema: eventRegistrationSchemas.data.moveToQuota,
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) => {
            const { eventId, variantId } = await registrationContext(prisma, params.registrationId)

            const promoted = await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                const registration = await tx.eventRegistration.findUniqueOrThrow({
                    where: { id: params.registrationId },
                    select: { id: true, quotaId: true, userId: true, state: true, contact: { select: { email: true } } },
                })
                const quota = await tx.eventQuota.findUniqueOrThrow({
                    where: { id: data.quotaId },
                    select: {
                        variantId: true,
                        places: true,
                        _count: { select: { registrations: true } },
                        variant: {
                            select: {
                                id: true,
                                eventId: true,
                                event: { select: { allowRegistrationInMultipleVariants: true } },
                            },
                        },
                    },
                })
                if (quota.variantId !== variantId) {
                    throw new Smorekopp('BAD PARAMETERS', 'Kvoten hører ikke til varianten.')
                }
                if (registration.quotaId === data.quotaId) return []
                if (quota._count.registrations >= quota.places) {
                    throw new Smorekopp('BAD PARAMETERS', 'Kvoten er full.')
                }

                await tx.eventRegistration.update({
                    where: { id: params.registrationId },
                    data: {
                        state: 'IN_QUOTA',
                        quotaId: data.quotaId,
                        waitingListVariantId: null,
                        promotedAt: registration.state === 'WAITING_LIST' ? new Date() : undefined,
                    },
                })
                await leaveOtherWaitingLists(tx, quota.variant, [registration.userId])
                const promotedByMove = await fixVariantPlaces(tx, variantId)

                // The pass fills the place the registration left, from the quotas after it in order,
                // and may take the registration itself back. Then the move did nothing.
                const moved = await tx.eventRegistration.findUniqueOrThrow({
                    where: { id: params.registrationId },
                    select: { quotaId: true },
                })
                if (moved.quotaId !== data.quotaId) {
                    throw new Smorekopp(
                        'BAD PARAMETERS',
                        'En kvote foran har ledig plass og tar påmeldingen tilbake. Fyll den plassen først.'
                    )
                }
                return registration.state === 'WAITING_LIST' ? [...promotedByMove, registration] : promotedByMove
            })

            await notifyPromoted(prisma, eventId, promoted)
        },
    }),

    /** For payments made outside the ledger, for example in person. */
    setManuallyPaid: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.setManuallyPaid.data(
            (await registrationOwnerAndAccess(prisma, params.registrationId)).access
        ),
        paramsSchema: eventRegistrationSchemas.params.setManuallyPaid,
        dataSchema: eventRegistrationSchemas.data.setManuallyPaid,
        operation: async ({ prisma, params, data }) => {
            const { variantId } = await registrationContext(prisma, params.registrationId)
            const variant = await prisma.eventVariant.findUniqueOrThrow({
                where: { id: variantId },
                select: { takesPayment: true },
            })
            if (data.manuallyPaid && !variant.takesPayment) {
                throw new Smorekopp('BAD PARAMETERS', 'Denne varianten tar ikke betaling.')
            }

            return await prisma.eventRegistration.update({
                where: { id: params.registrationId },
                data: { manuallyPaid: data.manuallyPaid },
                select: { id: true, manuallyPaid: true },
            })
        },
    }),

    /**
     * Someone not registered is turned away rather than registered on the spot. A second scan leaves
     * the first one standing, and says so in `alreadyAttended`.
     */
    registerAttendance: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.registerAttendance,
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.registerAttendance.data({
            ...await readEventAccess(prisma, params.eventId),
            userId: params.registeredById,
        }),
        operation: async ({ prisma, params }): Promise<EventAttendanceScan> => {
            // With a place in several variants, the first one scanned counts.
            const existing = await prisma.eventRegistration.findFirst({
                where: { userId: params.userId, ...registrationsOfEvent(params.eventId) },
                orderBy: [{ state: 'asc' }, { id: 'asc' }],
                select: { id: true },
            })

            if (!existing) {
                throw new Smorekopp('NOT FOUND', 'Denne brukeren er ikke påmeldt arrangementet.')
            }

            // Only written while attendance is not taken, so of two scans at once the first one stands.
            const { count } = await prisma.eventRegistration.updateMany({
                where: { id: existing.id, attendedAt: null },
                data: { attendedAt: new Date(), attendanceRegisteredById: params.registeredById },
            })

            return {
                registration: await prisma.eventRegistration.findUniqueOrThrow({
                    where: { id: existing.id },
                    select: eventRegistrationAttendanceSelection,
                }),
                counts: await countAttendance(prisma, params.eventId),
                alreadyAttended: count === 0,
            }
        },
    }),

    /** For guests, who have no Omega-ID to scan, and for taking back a wrong scan. */
    setAttendance: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.setAttendance,
        dataSchema: eventRegistrationSchemas.data.setAttendance,
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.setAttendance.data({
            ...(await registrationOwnerAndAccess(prisma, params.registrationId)).access,
            userId: params.registeredById,
        }),
        operation: async ({ prisma, params, data }): Promise<EventAttendanceRegistration> =>
            await writeAttendance(prisma, params.registrationId, data.attended, params.registeredById),
    }),

    readAttendanceCounts: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.readAttendanceCounts,
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readAttendanceCounts.data(
            await readEventAccess(prisma, params.eventId)
        ),
        operation: async ({ prisma, params }): Promise<EventAttendanceCounts> =>
            await countAttendance(prisma, params.eventId),
    }),

    /** The registrations with a place whose user did not show up. Guests have no user to give a dot. */
    readNotAttended: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.readNotAttended,
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readNotAttended.data(
            await readEventAccess(prisma, params.eventId)
        ),
        operation: async ({ prisma, params }): Promise<EventRegistrationNotAttended[]> => {
            const registrations = await prisma.eventRegistration.findMany({
                where: { ...notAttendedFilter(params.eventId), userId: { not: null } },
                orderBy: queueSegmentOrder(REGISTRATION_READER_TYPE.REGISTRATIONS),
                select: eventRegistrationNotAttendedSelection,
            })
            return registrations.flatMap(registration => (
                registration.user ? [{ ...registration, user: registration.user }] : []
            ))
        },
    }),

    /**
     * Gives a dot to someone registered to the event, with the name of the event appended to the
     * reason. It takes the admin level of the event rather than DOTS_ADMIN, so the ones running an
     * event may punish not showing up to it - and only that: the user must be registered to it.
     */
    createDot: dotOperations.internal.createInternal.implement({
        implementationParamsSchema: eventRegistrationSchemas.params.createDot,
        authorizer: async ({ implementationParams, params, prisma }) => eventRegistrationAuth.createDot.data({
            ...await readEventAccess(prisma, implementationParams.eventId),
            userId: params.accuserId,
        }),
        ownershipCheck: async ({ implementationParams, data, prisma }) =>
            await allRegistered(prisma, implementationParams.eventId, [data.userId]),
        operationImplementationFields: async ({ implementationParams, prisma }) => ({
            reasonContext: await eventName(prisma, implementationParams.eventId),
        }),
    }),

    /**
     * Gives everyone in the list a dot of the same value for not showing up to the event, as
     * `createDot` gives one. Each of them must have held a place and not shown up (see
     * `readNotAttended`), or none get a dot. The value is capped, since this hands out dots by the dozen.
     */
    createDotsForNonattendingUsers: dotOperations.internal.createManyInternal.implement({
        implementationParamsSchema: eventRegistrationSchemas.params.createDotsForNonattendingUsers,
        authorizer: async ({ implementationParams, params, prisma }) =>
            eventRegistrationAuth.createDotsForNonattendingUsers.data({
                ...await readEventAccess(prisma, implementationParams.eventId),
                userId: params.accuserId,
            }),
        ownershipCheck: async ({ implementationParams, data, prisma }) =>
            await allRegistered(prisma, implementationParams.eventId, data.userIds),
        beforeRun: async ({ implementationParams, data, prisma }) => {
            if (data.value > maxDotsForNotShowingUp) {
                throw new Smorekopp('BAD DATA', `Kan gi høyst ${maxDotsForNotShowingUp} prikker om gangen.`)
            }
            const eventId = implementationParams.eventId
            if (!await allRegistered(prisma, eventId, data.userIds, notAttendedFilter(eventId))) {
                throw new Smorekopp('BAD DATA', 'Noen av brukerne møtte opp, eller hadde ikke plass på arrangementet.')
            }
        },
        operationImplementationFields: async ({ implementationParams, prisma }) => ({
            reasonContext: await eventName(prisma, implementationParams.eventId),
        }),
    }),

    /**
     * Pays for a registration with a place, at the price of its variant: `amountFromBalance` from
     * the payer's ledger balance, the rest via `provider`, which is only required when the balance
     * doesn't cover the price.
     */
    createPayment: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.createPayment,
        authorizer: ({ params }) => eventRegistrationAuth.createPayment.data({ userId: params.userId }),
        transaction: 'OPENS',
        operation: async ({ prisma, params, session }): Promise<{ payment: ExpandedPayment | null }> => {
            const variant = await resolveVariant(prisma, params.eventId, params.variantId)
            const registrationOfPayer = { userId: params.userId, ...registrationsOfVariant(variant.id) }
            const found = await prisma.eventRegistration.findFirst({ where: registrationOfPayer, select: { id: true } })
            if (!found) {
                throw new Smorekopp('NOT FOUND', 'Fant ingen påmelding å betale for.')
            }

            const funds = variant.price
            if (!variant.takesPayment || !funds) {
                throw new Smorekopp('BAD PARAMETERS', 'Dette arrangementet krever ikke betaling.')
            }

            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.eventId },
                select: { name: true, ledgerAccountId: true },
            })
            const destinationAccountId = event.ledgerAccountId
            if (!destinationAccountId) {
                throw new Smorekopp('SERVER ERROR', 'Arrangementet er ikke knyttet til en konto å betale til.')
            }

            if (params.amountFromBalance > funds) {
                throw new Smorekopp('BAD PARAMETERS', 'Beløpet fra kontosaldo kan ikke overstige prisen.')
            }
            const shortfall = funds - params.amountFromBalance

            if (shortfall > 0 && !params.provider) {
                throw new Smorekopp('BAD PARAMETERS', 'Betalingsmetode må oppgis.')
            }

            let payment: ExpandedPayment | undefined
            const transaction: ExpandedLedgerTransaction = await prisma.$transaction(async tx => {
                // Locks the registration row so concurrent payment attempts for it serialize
                // instead of racing the existingAttempt check below. The registration is read under
                // the lock, since it may have been removed or lost its place while this waited.
                await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${found.id} FOR UPDATE`
                const locked = await tx.eventRegistration.findFirst({ where: { id: found.id, ...registrationOfPayer } })
                if (!locked) {
                    throw new Smorekopp('NOT FOUND', 'Fant ingen påmelding å betale for.')
                }
                const registration = withPaymentDeadline(locked, variant)

                if (registration.manuallyPaid) {
                    throw new Smorekopp('BAD PARAMETERS', 'Denne påmeldingen er allerede betalt.')
                }

                // Enforced here too, since the UI gate doesn't stop a direct call.
                if (registration.state === 'WAITING_LIST') {
                    throw new Smorekopp('BAD PARAMETERS', 'Du står på ventelisten og kan ikke betale før du får en plass.')
                }

                const now = new Date()
                if (
                    !variant.paymentStart || !registration.paymentDeadline
                    || now < variant.paymentStart || now > registration.paymentDeadline
                ) {
                    throw new Smorekopp('BAD PARAMETERS', 'Betalingsperioden for dette arrangementet er ikke åpen.')
                }

                const existingAttempt = await tx.ledgerTransaction.findFirst({
                    where: {
                        eventRegistrationId: registration.id,
                        state: { in: ['PENDING', 'SUCCEEDED'] },
                    },
                })
                if (existingAttempt?.state === 'SUCCEEDED') {
                    throw new Smorekopp('BAD PARAMETERS', 'Denne påmeldingen er allerede betalt.')
                }
                if (existingAttempt) {
                    // The registrant may always replace a pending attempt, even one an admin
                    // started for them. Anyone else has to wait until the ledger sweeper cancels it.
                    if (session.user?.id !== params.userId) {
                        throw new Smorekopp('BAD PARAMETERS', 'Denne påmeldingen har allerede en betaling under behandling.')
                    }
                    // Cancel it, so a late webhook can't complete it. Bypassed, since the outer
                    // authorizer already allows this caller to pay for the registration.
                    await ledgerTransactionOperations.cancel({
                        params: { id: existingAttempt.id },
                        bypassAuth: true,
                        prisma: tx,
                    })
                }

                if (shortfall > 0) {
                    payment = await paymentOperations.create({
                        params: {
                            provider: params.provider!,
                            funds: shortfall,
                            manualFees: params.manualFees,
                            descriptionLong: `Betaling for påmelding til ${event.name}`,
                            descriptionShort: 'Arrangement',
                            userId: params.userId,
                        },
                        prisma: tx,
                    })
                }

                // Outer authorizer (eventRegistrationAuth.createPayment) already covers
                // whether this caller may pay for params.userId's registration, which
                // read's own ownership check would otherwise re-reject an admin for.
                const payerAccount = params.amountFromBalance > 0
                    ? await ledgerAccountOperations.read({
                        params: { userId: params.userId },
                        bypassAuth: true,
                        prisma: tx,
                    })
                    : undefined

                return await ledgerTransactionOperations.create({
                    params: {
                        purpose: 'EVENT_PAYMENT',
                        ledgerEntries: [
                            { ledgerAccountId: destinationAccountId, funds },
                            ...(payerAccount
                                ? [{ ledgerAccountId: payerAccount.id, funds: -params.amountFromBalance }]
                                : []),
                        ],
                        paymentId: payment?.id,
                        eventRegistrationId: registration.id,
                        description: params.provider === 'MANUAL' ? params.description : undefined,
                    },
                    prisma: tx,
                })
            })

            // Returns the live clientSecret. If starting the payment fails, initiate cancels the
            // attempt so the registration can be paid for again.
            return {
                payment: await ledgerTransactionOperations.initiate({
                    params: { id: transaction.id },
                    bypassAuth: true,
                }),
            }
        },
    }),
} as const

/**
 * The variant a registration goes to: the one named, which must be the event's, or the event's only
 * one. With its quotas in fill order and what the event allows.
 */
async function resolveVariant(prisma: PrismaPossibleTransaction<false>, eventId: number, variantId: number | undefined) {
    const variants = await prisma.eventVariant.findMany({
        where: { eventId, ...(variantId === undefined ? {} : { id: variantId }) },
        orderBy: eventVariantOrder,
        select: {
            id: true,
            eventId: true,
            registrationStart: true,
            registrationEnd: true,
            takesPayment: true,
            price: true,
            paymentStart: true,
            paymentEnd: true,
            event: { select: { waitingList: true, allowRegistrationInMultipleVariants: true } },
            quotas: {
                orderBy: eventQuotaOrder,
                select: {
                    id: true,
                    places: true,
                    visibility: { include: visibilityIncluder },
                    _count: { select: { registrations: true } },
                },
            },
        },
    })
    if (variants.length === 0) {
        throw new Smorekopp(
            'BAD PARAMETERS',
            variantId === undefined ? 'Arrangementet har ikke påmelding.' : 'Varianten hører ikke til arrangementet.'
        )
    }
    if (variants.length > 1) {
        throw new Smorekopp('BAD PARAMETERS', 'Arrangementet har flere varianter. Velg én.')
    }
    return variants[0]
}

type ResolvedVariant = Awaited<ReturnType<typeof resolveVariant>>

/** A registrant, as a user or as a guest. */
type Registrant = { userId: number } | { contactId: number, note: string }

/**
 * One registration per user per variant, and, unless the event allows it, no place in one variant
 * while holding a place in another. The database holds these per quota and per waiting list, not
 * across them, so they are checked here, under the event lock.
 */
async function assertMayJoin(tx: Prisma.TransactionClient, variant: ResolvedVariant, userId: number) {
    const existing = await tx.eventRegistration.findFirst({
        where: { userId, ...registrationsOfVariant(variant.id) },
        select: { id: true },
    })
    if (existing) {
        throw new Smorekopp('DUPLICATE', 'Brukeren er allerede påmeldt denne varianten av arrangementet.')
    }
    if (variant.event.allowRegistrationInMultipleVariants) return

    const seatedElsewhere = await tx.eventRegistration.findFirst({
        where: { userId, ...seatedInEvent(variant.eventId) },
        select: { id: true },
    })
    if (seatedElsewhere) {
        throw new Smorekopp('BAD PARAMETERS', 'Brukeren har allerede plass i en annen variant av arrangementet.')
    }
}

/** How long the user's dots push the registration start back for them, in milliseconds; bans throw. */
async function delayOf(tx: Prisma.TransactionClient, userId: number) {
    const punishment = await readDotPunishmentOfUser({ params: { userId }, prisma: tx, bypassAuth: true })
    if (punishment.type === 'ban') {
        throw new Smorekopp('BAD PARAMETERS', 'Du har for mange prikker til å melde deg på arrangementer.')
    }
    return punishment.type === 'timeout' ? punishment.punishmentMinutes * 60 * 1000 : 0
}

/** The variant takes registration, is open now for the user, and has a quota they pass. */
function assertOpenForUser(variant: ResolvedVariant, memberships: MembershipFiltered[], delayMs: number) {
    if (!variant.quotas.some(quota => quota.places > 0)) {
        throw new Smorekopp('BAD PARAMETERS', 'Arrangementet har ikke påmelding.')
    }
    const now = Date.now()
    const opensAt = variant.registrationStart.getTime() + delayMs
    if (variant.registrationEnd.getTime() < now) {
        throw new Smorekopp('BAD PARAMETERS', 'Påmeldingen er stengt.')
    }
    if (opensAt > now) {
        throw new Smorekopp('BAD PARAMETERS', delayMs > 0
            ? `Du har prikker og kan derfor først melde deg på ${displayDate(new Date(opensAt))}.`
            : 'Påmeldingen har ikke åpnet ennå.')
    }
    if (!variant.quotas.some(quota => checkVisibility(memberships, toMatrix(quota.visibility)))) {
        throw new Smorekopp('BAD PARAMETERS', 'Ingen av kvotene på arrangementet er åpne for deg.')
    }
}

/**
 * Joins the waiting list of the variant and lets `fixVariantPlaces` seat the registration if a
 * place is free. Left waiting at an event without a waiting list, it is refused instead.
 */
async function joinVariant(tx: Prisma.TransactionClient, variant: ResolvedVariant, registrant: Registrant) {
    const created = await tx.eventRegistration.create({
        data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, ...registrant },
    })
    const promoted = await fixVariantPlaces(tx, variant.id, created.id)
    const registration = await tx.eventRegistration.findUniqueOrThrow({ where: { id: created.id } })
    if (registration.state === 'WAITING_LIST' && !variant.event.waitingList) {
        throw new Smorekopp('BAD PARAMETERS', 'Arrangementet er fullt.')
    }
    return { registration, promoted }
}

/** An administrator seats the registrant in the quota they name, or the first with a place, regardless of visibility. */
async function placeAsAdmin(
    tx: Prisma.TransactionClient,
    variant: ResolvedVariant,
    registrant: Registrant,
    quotaId: number | null,
) {
    const hasPlace = (quota: ResolvedVariant['quotas'][number]) => quota._count.registrations < quota.places
    const named = quotaId === null ? undefined : variant.quotas.find(quota => quota.id === quotaId)
    if (quotaId !== null && !named) {
        throw new Smorekopp('BAD PARAMETERS', 'Kvoten hører ikke til varianten.')
    }
    if (named && !hasPlace(named)) {
        throw new Smorekopp('BAD PARAMETERS', 'Kvoten er full.')
    }
    const quota = named ?? variant.quotas.find(hasPlace)
    if (!quota) return await joinVariant(tx, variant, registrant)

    const registration = await tx.eventRegistration.create({
        data: { state: 'IN_QUOTA', quotaId: quota.id, ...registrant },
    })
    await leaveOtherWaitingLists(tx, variant, ['userId' in registrant ? registrant.userId : null])
    return { registration, promoted: await fixVariantPlaces(tx, variant.id) }
}

/** The event and variant a registration belongs to, through its quota or its waiting list, and its user. */
async function registrationContext(prisma: PrismaPossibleTransaction<false>, registrationId: number) {
    const registration = await prisma.eventRegistration.findUniqueOrThrow({
        where: { id: registrationId },
        select: {
            userId: true,
            waitingListVariant: { select: { id: true, eventId: true } },
            quota: { select: { variant: { select: { id: true, eventId: true } } } },
        },
    })
    const variant = registration.quota?.variant ?? registration.waitingListVariant
    if (!variant) {
        throw new Smorekopp('SERVER ERROR', 'Påmeldingen hører verken til en kvote eller en venteliste.')
    }
    return { userId: registration.userId, eventId: variant.eventId, variantId: variant.id }
}

async function registrationOwnerAndAccess(prisma: PrismaPossibleTransaction<false>, registrationId: number) {
    const { userId, eventId } = await registrationContext(prisma, registrationId)
    return { userId, access: await readEventAccess(prisma, eventId) }
}

async function countAttendance(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number
): Promise<EventAttendanceCounts> {
    const [attended, total, attendedFromWaitingList] = await Promise.all([
        prisma.eventRegistration.count({ where: { ...seatedInEvent(eventId), attendedAt: { not: null } } }),
        prisma.eventRegistration.count({ where: seatedInEvent(eventId) }),
        prisma.eventRegistration.count({ where: { ...waitingInEvent(eventId), attendedAt: { not: null } } }),
    ])

    return { attended, total, attendedFromWaitingList }
}

async function writeAttendance(
    prisma: PrismaPossibleTransaction<false>,
    registrationId: number,
    attended: boolean,
    registeredById: number
) {
    // Saving a box that was already ticked keeps when they showed up and who let them in.
    await prisma.eventRegistration.updateMany({
        where: attended ? { id: registrationId, attendedAt: null } : { id: registrationId },
        data: attended
            ? { attendedAt: new Date(), attendanceRegisteredById: registeredById }
            : { attendedAt: null, attendanceRegisteredById: null },
    })

    return await prisma.eventRegistration.findUniqueOrThrow({
        where: { id: registrationId },
        select: eventRegistrationAttendanceSelection,
    })
}

function notAttendedFilter(eventId: number): Prisma.EventRegistrationWhereInput {
    return { ...seatedInEvent(eventId), attendedAt: null }
}

/** Whether every one of the users is registered to the event, with a registration matching `where` when given. */
async function allRegistered(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    userIds: number[],
    where: Prisma.EventRegistrationWhereInput = registrationsOfEvent(eventId)
) {
    const uniqueUserIds = Array.from(new Set(userIds))
    const registered = await prisma.eventRegistration.findMany({
        where: { ...where, userId: { in: uniqueUserIds } },
        select: { userId: true },
        distinct: ['userId'],
    })
    return registered.length === uniqueUserIds.length
}

async function eventName(prisma: PrismaPossibleTransaction<false>, eventId: number) {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { name: true },
    })
    return event.name
}
