import '@pn-server-only'
import {
    eventRegistrationAttendanceSelection,
    eventRegistrationNotAttendedSelection,
    eventRegistrationSelectionDetailed,
    eventRegistrationQueueOrder,
    eventRegistrationSelection,
    maxDotsForNotShowingUp,
    REGISTRATION_READER_TYPE,
} from './constants'
import { eventRegistrationAuth } from './auth'
import { eventRegistrationSchemas } from './schemas'
import { notifyPromotedFromWaitingList } from './notifyPromotedFromWaitingList'
import { promoteToQuota } from './promote'
import {
    lockEvent,
    queuedAhead,
    queuedBehind,
    queueSegmentFilter,
    queueSegmentOrder,
    registrationsOfEvent,
    seatedInEvent,
    untieQueue,
    waitingInEvent,
} from './queue'
import { dotOperations } from '@/services/dots/operations'
import { displayDate } from '@/lib/dates/displayDate'
import { Smorekopp } from '@/services/error'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { readEventAccess } from '@/services/events/access'
import { eventQuotaOrder } from '@/services/events/constants'
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
} from './types'

/**
 * What the dots of a user hold them back from when registering to an event.
 */
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

/** Where a new registration lands: a place in a quota, or the waiting list of the event. */
type Placement = { state: 'IN_QUOTA', quotaId: number } | { state: 'WAITING_LIST' }

/**
 * Registers a user to an event. Implemented twice below: as `create`, where users register
 * themselves and are placed by the fill order of the quotas, within their registration periods and
 * held back by their dots, and as `createAsAdmin`, where an administrator of the event registers
 * anyone into the quota they name, at any time, regardless of dots.
 */
// Spelled out as a union: inferred, the conditional would reduce it to the plain schema, as the
// one with the quota is assignable to it, and the quota would be lost to the types.
type CreateParamsSchema =
    | typeof eventRegistrationSchemas.params.create
    | typeof eventRegistrationSchemas.params.createAsAdmin

const createRegistration = defineSubOperation({
    paramsSchema: ({ asAdmin }: { asAdmin: boolean }): CreateParamsSchema => (asAdmin
        ? eventRegistrationSchemas.params.createAsAdmin
        : eventRegistrationSchemas.params.create),
    opensTransaction: true,
    operation: ({ asAdmin }: { asAdmin: boolean }) =>
        async ({ prisma, params, session }) =>
            await prisma.$transaction(async tx => {
                const event = await lockEventForRegistration(tx, params.eventId)
                await assertNotRegistered(tx, params.eventId, params.userId)
                const pickedQuotaId = 'quotaId' in params && typeof params.quotaId === 'number' ? params.quotaId : null
                const placement = asAdmin
                    ? placeAsAdmin(event, pickedQuotaId)
                    : await placeUser(tx, event, params.userId, session.memberships)

                return await tx.eventRegistration.create({
                    data: {
                        ...placementData(placement, params.eventId),
                        userId: params.userId,
                    },
                })
            }),
})

/**
 * Unregisters. When the registration held a place and someone on the waiting list passes its quota,
 * the first of them takes the place and is told so once the change is saved. The event is locked
 * while the places change, so a registration arriving at the same time cannot be skipped.
 * Implemented twice below: as `destroy`, where users unregister themselves, within the registration
 * period of their quota and never from a binding registration, and as `destroyAsAdmin`, where an
 * administrator of the event removes any registration at any time.
 */
const destroyRegistration = defineSubOperation({
    paramsSchema: () => eventRegistrationSchemas.params.destroy,
    opensTransaction: true,
    operation: ({ asAdmin }: { asAdmin: boolean }) =>
        async ({ prisma, params }) => {
            const { eventId } = await registrationContext(prisma, params.registrationId)

            const promoted = await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                const registration = await tx.eventRegistration.findUniqueOrThrow({
                    where: { id: params.registrationId },
                    select: {
                        id: true,
                        userId: true,
                        quotaId: true,
                        quota: { select: { registrationEnd: true } },
                    },
                })
                const event = await tx.event.findUniqueOrThrow({
                    where: { id: eventId },
                    select: { name: true, bindingRegistration: true },
                })

                if (!asAdmin) {
                    if (event.bindingRegistration) {
                        throw new Smorekopp(
                            'BAD PARAMETERS',
                            'Påmeldingen er bindende. Ta kontakt med arrangørene om du ikke kan komme.'
                        )
                    }
                    if (registration.quota && registration.quota.registrationEnd < new Date()) {
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

                await tx.eventRegistration.delete({
                    where: {
                        id: params.registrationId,
                    },
                })
                if (registration.quotaId === null) return null

                const nextInLine = await promoteToQuota(tx, registration.quotaId)
                return nextInLine.length ? { event: { id: eventId, name: event.name }, nextInLine } : null
            })

            if (promoted) {
                await notifyPromotedFromWaitingList(promoted.event, promoted.nextInLine)
            }
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

    /** Registers someone without a user, by name, into the quota the administrator names or the first with a place. */
    createGuest: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.createGuest.data(
            await readEventAccess(prisma, params.eventId)
        ),
        paramsSchema: eventRegistrationSchemas.params.createGuest,
        dataSchema: eventRegistrationSchemas.data.createGuest,
        opensTransaction: true,
        operation: async ({ prisma, params, data }) =>
            await prisma.$transaction(async tx => {
                const event = await lockEventForRegistration(tx, params.eventId)
                const placement = placeAsAdmin(event, params.quotaId ?? null)
                const contact = await tx.contactDetails.create({ data: { name: data.name } })

                return await tx.eventRegistration.create({
                    data: {
                        ...placementData(placement, params.eventId),
                        note: data.note,
                        contactId: contact.id,
                    },
                })
            }),
    }),

    readDotPunishmentOfUser,

    /**
     * The registration of one user to one event, or null if that user is not registered. Its state
     * says whether it holds a place or queues on the waiting list.
     */
    readOfUser: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readOfUser({
            userId: params.userId,
            access: await readEventAccess(prisma, params.eventId),
        }),
        paramsSchema: eventRegistrationSchemas.params.readOfUser,
        operation: async ({ prisma, params }): Promise<EventRegistrationOfUser | null> =>
            await prisma.eventRegistration.findFirst({
                where: { userId: params.userId, ...registrationsOfEvent(params.eventId) },
                include: {
                    quota: { select: { id: true, name: true, price: true, registrationEnd: true } },
                    // Only need to know whether a payment exists and is still in effect, to gate
                    // the "pay for registration" UI once it's already been paid for.
                    ledgerTransactions: {
                        where: validTransactionFilter,
                        select: { id: true },
                    },
                },
            }),
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

    /** Notes may change while the quota's registration is open; the waiting list has no deadline of its own. */
    updateNotes: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.updateNotes(
            await registrationOwnerAndAccess(prisma, params.registrationId)
        ),
        paramsSchema: eventRegistrationSchemas.params.updateNotes,
        dataSchema: eventRegistrationSchemas.data.updateNotes,
        operation: async ({ prisma, params, data }) => {
            const registration = await prisma.eventRegistration.findUniqueOrThrow({
                where: { id: params.registrationId },
                select: { quota: { select: { registrationEnd: true } } },
            })

            if (registration.quota && registration.quota.registrationEnd < new Date()) {
                throw new Smorekopp('BAD PARAMETERS', 'Kan ikke endre påmelding etter påmeldingsfristen.')
            }

            return await prisma.eventRegistration.update({
                where: {
                    id: params.registrationId,
                },
                data: {
                    note: data.note,
                },
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

    /**
     * Moves a registration one step up or down the waiting list by trading queue times with the
     * registration next to it. It is silent: no place changes hands, since a place is only given
     * when one frees up.
     */
    move: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.move.data(
            (await registrationOwnerAndAccess(prisma, params.registrationId)).access
        ),
        paramsSchema: eventRegistrationSchemas.params.move,
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            const { eventId } = await registrationContext(prisma, params.registrationId)

            await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                const registration = await tx.eventRegistration.findUniqueOrThrow({
                    where: { id: params.registrationId },
                    select: { id: true, queuedAt: true, state: true },
                })
                if (registration.state !== 'WAITING_LIST') {
                    throw new Smorekopp('BAD PARAMETERS', 'Bare ventelisten har en kø å flytte i.')
                }
                const up = params.direction === 'UP'

                const neighbour = await tx.eventRegistration.findFirst({
                    where: { ...waitingInEvent(eventId), ...(up ? queuedAhead(registration) : queuedBehind(registration)) },
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
                    ? await untieQueue(tx, eventId)
                    : new Map([[ahead.id, ahead.queuedAt], [behind.id, behind.queuedAt]])
                await tx.eventRegistration.update({ where: { id: behind.id }, data: { queuedAt: times.get(ahead.id) } })
                await tx.eventRegistration.update({ where: { id: ahead.id }, data: { queuedAt: times.get(behind.id) } })
            })
        },
    }),

    /**
     * Gives a registration a place in a quota of its event, from the waiting list or from another
     * quota, whose freed place then goes to the waiting list. The administrator is not held to the
     * quota's visibility or period, only to its places.
     */
    moveToQuota: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.moveToQuota.data(
            (await registrationOwnerAndAccess(prisma, params.registrationId)).access
        ),
        paramsSchema: eventRegistrationSchemas.params.moveToQuota,
        dataSchema: eventRegistrationSchemas.data.moveToQuota,
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            const { eventId } = await registrationContext(prisma, params.registrationId)

            const promoted = await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                const registration = await tx.eventRegistration.findUniqueOrThrow({
                    where: { id: params.registrationId },
                    select: { quotaId: true },
                })
                const quota = await tx.eventRegistrationQuota.findUniqueOrThrow({
                    where: { id: data.quotaId },
                    select: { eventId: true, places: true, _count: { select: { registrations: true } } },
                })
                if (quota.eventId !== eventId) {
                    throw new Smorekopp('BAD PARAMETERS', 'Kvoten hører ikke til arrangementet.')
                }
                if (registration.quotaId === data.quotaId) return []
                if (!hasPlace(quota)) {
                    throw new Smorekopp('BAD PARAMETERS', 'Kvoten er full.')
                }

                await tx.eventRegistration.update({
                    where: { id: params.registrationId },
                    data: { state: 'IN_QUOTA', quotaId: data.quotaId, waitingListEventId: null },
                })
                return registration.quotaId === null ? [] : await promoteToQuota(tx, registration.quotaId)
            })

            if (promoted.length) {
                await notifyPromotedFromWaitingList({ id: eventId, name: await eventName(prisma, eventId) }, promoted)
            }
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
            const { eventId } = await registrationContext(prisma, params.registrationId)
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: eventId },
                select: { takesPayment: true },
            })
            if (data.manuallyPaid && !event.takesPayment) {
                throw new Smorekopp('BAD PARAMETERS', 'Dette arrangementet tar ikke betaling.')
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
            const existing = await prisma.eventRegistration.findFirst({
                where: { userId: params.userId, ...registrationsOfEvent(params.eventId) },
                select: {
                    id: true,
                },
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

    /**
     * The registrations with a place at the event whose user did not show up - the ones dots for
     * not showing up go to. Guests have no user to give a dot, and the waiting list never had a
     * place to show up to.
     */
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
     * Pays for an existing registration, at the price of its quota: `amountFromBalance` from the
     * payer's ledger balance, the rest via `provider`, which is only required when the balance
     * doesn't cover the price.
     */
    createPayment: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.createPayment,
        authorizer: ({ params }) => eventRegistrationAuth.createPayment.data({ userId: params.userId }),
        opensTransaction: true,
        operation: async ({ prisma, params, session }): Promise<{ payment: ExpandedPayment | null }> => {
            const registration = await prisma.eventRegistration.findFirst({
                where: { userId: params.userId, ...registrationsOfEvent(params.eventId) },
                include: { quota: { select: { price: true } } },
            })

            if (!registration) {
                throw new Smorekopp('NOT FOUND', 'Fant ingen påmelding å betale for.')
            }

            const event = await prisma.event.findUniqueOrThrow({ where: { id: params.eventId } })

            if (!event.takesPayment) {
                throw new Smorekopp('BAD PARAMETERS', 'Dette arrangementet krever ikke betaling.')
            }

            if (registration.manuallyPaid) {
                throw new Smorekopp('BAD PARAMETERS', 'Denne påmeldingen er allerede betalt.')
            }

            // Enforced here too, since the UI gate doesn't stop a direct call.
            if (registration.state === 'WAITING_LIST' || !registration.quota) {
                throw new Smorekopp('BAD PARAMETERS', 'Du står på ventelisten og kan ikke betale før du får en plass.')
            }
            const funds = registration.quota.price
            if (!funds) {
                throw new Smorekopp('BAD PARAMETERS', 'Dette arrangementet krever ikke betaling.')
            }

            const now = new Date()
            if (!event.paymentStart || !event.paymentEnd || now < event.paymentStart || now > event.paymentEnd) {
                throw new Smorekopp('BAD PARAMETERS', 'Betalingsperioden for dette arrangementet er ikke åpen.')
            }

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
                // instead of racing the existingAttempt check below.
                await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${registration.id} FOR UPDATE`

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

/** The event a registration belongs to, through its quota or its waiting list, and its user. */
async function registrationContext(prisma: PrismaPossibleTransaction<false>, registrationId: number) {
    const registration = await prisma.eventRegistration.findUniqueOrThrow({
        where: { id: registrationId },
        select: { userId: true, waitingListEventId: true, quota: { select: { eventId: true } } },
    })
    const eventId = registration.quota?.eventId ?? registration.waitingListEventId
    if (eventId === null) {
        throw new Smorekopp('SERVER ERROR', 'Påmeldingen hører verken til en kvote eller en venteliste.')
    }
    return { userId: registration.userId, eventId }
}

/** What the rules on one registration need: who owns it, null for a guest, and the access of its event. */
async function registrationOwnerAndAccess(prisma: PrismaPossibleTransaction<false>, registrationId: number) {
    const { userId, eventId } = await registrationContext(prisma, registrationId)
    return { userId, access: await readEventAccess(prisma, eventId) }
}

/**
 * Locks the event and reads its quotas in fill order, with their visibilities and how many hold a
 * place in each. Run it in the registering transaction, so two registrations cannot both take the
 * last place.
 */
async function lockEventForRegistration(tx: Prisma.TransactionClient, eventId: number) {
    await lockEvent(tx, eventId)
    const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
            id: true,
            waitingList: true,
            quotas: {
                orderBy: eventQuotaOrder,
                select: {
                    id: true,
                    places: true,
                    registrationStart: true,
                    registrationEnd: true,
                    visibility: { include: visibilityIncluder },
                    _count: { select: { registrations: true } },
                },
            },
        },
    })

    if (event.quotas.length === 0) {
        throw new Smorekopp('BAD PARAMETERS', 'Arrangementet har ikke påmelding.')
    }
    return event
}

type EventForRegistration = Awaited<ReturnType<typeof lockEventForRegistration>>

/**
 * One registration per user per event. The database holds that per quota and per waiting list,
 * not across them, so it is checked here, under the event lock.
 */
async function assertNotRegistered(tx: Prisma.TransactionClient, eventId: number, userId: number) {
    const existing = await tx.eventRegistration.findFirst({
        where: { userId, ...registrationsOfEvent(eventId) },
        select: { id: true },
    })
    if (existing) {
        throw new Smorekopp('DUPLICATE', 'Brukeren er allerede påmeldt arrangementet.')
    }
}

function hasPlace(quota: { places: number, _count: { registrations: number } }) {
    return quota._count.registrations < quota.places
}

/** The waiting list, if the event has one. */
function waitingListOrFull(event: { waitingList: boolean }): Placement {
    if (!event.waitingList) {
        throw new Smorekopp('BAD PARAMETERS', 'Arrangementet er fullt.')
    }
    return { state: 'WAITING_LIST' }
}

/** An administrator fills the quota they name, or the first with a place, regardless of visibility and period. */
function placeAsAdmin(event: EventForRegistration, quotaId: number | null): Placement {
    if (quotaId !== null) {
        const quota = event.quotas.find(candidate => candidate.id === quotaId)
        if (!quota) {
            throw new Smorekopp('BAD PARAMETERS', 'Kvoten hører ikke til arrangementet.')
        }
        if (!hasPlace(quota)) {
            throw new Smorekopp('BAD PARAMETERS', 'Kvoten er full.')
        }
        return { state: 'IN_QUOTA', quotaId }
    }

    const open = event.quotas.find(hasPlace)
    return open ? { state: 'IN_QUOTA', quotaId: open.id } : waitingListOrFull(event)
}

/**
 * Places a user by the fill order: the first quota they pass that is open to them now and has a
 * place left. Their dots bar them, or push every quota's start back for them. With no place left in
 * the quotas they pass, they join the waiting list, if the event has one.
 */
async function placeUser(
    tx: Prisma.TransactionClient,
    event: EventForRegistration,
    userId: number,
    memberships: MembershipFiltered[],
): Promise<Placement> {
    const punishment = await readDotPunishmentOfUser({ params: { userId }, prisma: tx, bypassAuth: true })
    if (punishment.type === 'ban') {
        throw new Smorekopp('BAD PARAMETERS', 'Du har for mange prikker til å melde deg på arrangementer.')
    }
    const delayMs = punishment.type === 'timeout' ? punishment.punishmentMinutes * 60 * 1000 : 0

    const passing = event.quotas.filter(quota => checkVisibility(memberships, toMatrix(quota.visibility)))
    if (passing.length === 0) {
        throw new Smorekopp('BAD PARAMETERS', 'Ingen av kvotene på arrangementet er åpne for deg.')
    }

    const now = Date.now()
    const opensAt = (quota: { registrationStart: Date }) => quota.registrationStart.getTime() + delayMs
    const open = passing.filter(quota => opensAt(quota) <= now && now <= quota.registrationEnd.getTime())
    if (open.length === 0) {
        if (passing.every(quota => quota.registrationEnd.getTime() < now)) {
            throw new Smorekopp('BAD PARAMETERS', 'Påmeldingen er stengt.')
        }
        if (delayMs > 0) {
            const earliest = Math.min(...passing.filter(quota => opensAt(quota) > now).map(opensAt))
            throw new Smorekopp(
                'BAD PARAMETERS',
                `Du har prikker og kan derfor først melde deg på ${displayDate(new Date(earliest))}.`
            )
        }
        throw new Smorekopp('BAD PARAMETERS', 'Påmeldingen har ikke åpnet ennå.')
    }

    const withPlace = open.find(hasPlace)
    return withPlace ? { state: 'IN_QUOTA', quotaId: withPlace.id } : waitingListOrFull(event)
}

function placementData(
    placement: Placement,
    eventId: number,
): Pick<Prisma.EventRegistrationUncheckedCreateInput, 'state' | 'quotaId' | 'waitingListEventId'> {
    return placement.state === 'IN_QUOTA'
        ? { state: 'IN_QUOTA', quotaId: placement.quotaId }
        : { state: 'WAITING_LIST', waitingListEventId: eventId }
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

/** The registrations with a place at the event that were not shown up to; the waiting list had no place to show up to. */
function notAttendedFilter(eventId: number): Prisma.EventRegistrationWhereInput {
    return { ...seatedInEvent(eventId), attendedAt: null }
}

/**
 * Whether every one of the users is registered to the event - what makes a dot for the event
 * theirs to get - with a registration matching `where`, when given. Each user registers once per
 * event, so the count of registrations says it.
 */
async function allRegistered(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    userIds: number[],
    where: Prisma.EventRegistrationWhereInput = registrationsOfEvent(eventId)
) {
    const uniqueUserIds = Array.from(new Set(userIds))
    const registered = await prisma.eventRegistration.count({
        where: { ...where, userId: { in: uniqueUserIds } },
    })
    return registered === uniqueUserIds.length
}

async function eventName(prisma: PrismaPossibleTransaction<false>, eventId: number) {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { name: true },
    })
    return event.name
}
