import '@pn-server-only'
import {
    eventRegistrationAttendanceSelection,
    eventRegistrationNotAttendedSelection,
    eventRegistrationSelectionDetailed,
    eventRegistrationQueueOrder,
    eventRegistrationSelection,
    maxDotsForNotShowingUp,
} from './constants'
import { eventAdminLevel, eventRegistrationAuth } from './auth'
import { eventRegistrationSchemas } from './schemas'
import { notifyPromotedFromWaitingList } from './notifyPromotedFromWaitingList'
import { firstOnWaitingList, lockEvent, queuePosition, queueSegmentFilter } from './queue'
import { dotOperations } from '@/services/dots/operations'
import { displayDate } from '@/lib/dates/displayDate'
import { Smorekopp } from '@/services/error'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { eventOperations } from '@/services/events/operations'
import { defineOperation, defineSubOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { stalePendingTransactionMs } from '@/services/ledger/transactions/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type {
    DotPunishment,
    EventAttendanceCounts,
    EventAttendanceRegistration,
    EventAttendanceScan,
    EventRegistrationExpanded,
    EventRegistrationNotAttended,
    EventRegistrationWithWaitingList,
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

/**
 * Registers a user to an event. Implemented twice below: as `create`, where users register
 * themselves and the registration period and their dots apply, and as `createAsAdmin`, where an
 * administrator of the event registers anyone, at any time, regardless of dots.
 */
const createRegistration = defineSubOperation({
    paramsSchema: () => eventRegistrationSchemas.params.create,
    opensTransaction: true,
    operation: ({ asAdmin }: { asAdmin: boolean }) =>
        async ({ prisma, params }): Promise<EventRegistrationWithWaitingList> =>
            await prisma.$transaction(async tx => {
                const event = await lockEventOpenForRegistration(tx, params.eventId, asAdmin)
                await validateDotPunishmentOfRegistration(tx, event.registrationStart, params.userId, asAdmin)

                const registration = await tx.eventRegistration.create({
                    data: {
                        user: {
                            connect: {
                                id: params.userId,
                            },
                        },
                        event: {
                            connect: {
                                id: params.eventId,
                            },
                        },
                    },
                })

                return {
                    ...registration,
                    onWaitingList: event._count.eventRegistrations >= event.places,
                }
            }),
})

export const eventRegistrationOperations = {
    create: createRegistration.implement({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.create.data({
            userId: params.userId,
            ...await eventVisibilityAndPublished(prisma, params.eventId),
        }),
        ownershipCheck: () => true,
        operationImplementationFields: { asAdmin: false },
    }),

    createAsAdmin: createRegistration.implement({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.createAsAdmin.data({
            visibility: await eventVisibility(prisma, params.eventId),
        }),
        ownershipCheck: () => true,
        operationImplementationFields: { asAdmin: true },
    }),

    createGuest: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.createGuest.data({
            visibility: await eventVisibility(prisma, params.eventId)
        }),
        paramsSchema: eventRegistrationSchemas.params.createGuest,
        dataSchema: eventRegistrationSchemas.data.createGuest,
        opensTransaction: true,
        operation: async ({ prisma, params, data }): Promise<EventRegistrationWithWaitingList> =>
            await prisma.$transaction(async tx => {
                const event = await lockEventOpenForRegistration(tx, params.eventId, true)

                const registration = await tx.eventRegistration.create({
                    data: {
                        event: {
                            connect: {
                                id: params.eventId,
                            },
                        },
                        note: data.note,
                        contact: {
                            create: {
                                name: data.name,
                            },
                        },
                    },
                })

                return {
                    ...registration,
                    onWaitingList: event._count.eventRegistrations >= event.places,
                }
            }),
    }),

    readDotPunishmentOfUser,

    /**
     * The registration of one user to one event, or null if that user is not registered. Tells
     * whether the registration landed on the waiting list, so the one registered can be shown where
     * they stand.
     */
    readOfUser: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readOfUser({
            userId: params.userId,
            doubleLevelMatrix: await eventVisibility(prisma, params.eventId),
        }),
        paramsSchema: eventRegistrationSchemas.params.readOfUser,
        operation: async (
            { prisma, params }
        ): Promise<(EventRegistrationWithWaitingList & { ledgerTransactions: { id: number }[] }) | null> => {
            const registration = await prisma.eventRegistration.findUnique({
                where: {
                    eventId_userId: {
                        eventId: params.eventId,
                        userId: params.userId,
                    },
                },
                include: {
                    event: { select: { places: true } },
                    // Only need to know whether a successful payment exists, to gate the
                    // "pay for registration" UI once it's already been paid for.
                    ledgerTransactions: {
                        where: { state: 'SUCCEEDED' },
                        select: { id: true },
                    },
                },
            })
            if (!registration) return null

            const { event, ...rest } = registration
            return {
                ...rest,
                onWaitingList: await queuePosition(prisma, registration) >= event.places,
            }
        },
    }),

    readPage: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readPage.data(
            await eventVisibilityAndPublished(prisma, params.paging.details.eventId)
        ),
        paramsSchema: eventRegistrationSchemas.params.readPage,
        operation: async ({ prisma, params }): Promise<EventRegistrationExpanded[]> => {
            const segment = await queueSegmentFilter(prisma, params.paging.details)
            if (!segment) return []

            const defaultImage = await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_PROFILE_IMAGE' },
            })

            const registrations = await prisma.eventRegistration.findMany({
                ...cursorPagingSelection(params.paging.page),
                where: segment,
                orderBy: eventRegistrationQueueOrder,
                select: eventRegistrationSelection,
            })

            return registrations.map(registration => ({
                ...registration,
                image: registration.user?.image || defaultImage,
            }))
        },
    }),

    readPageDetailed: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readPageDetailed.data({
            visibility: await eventVisibility(prisma, params.paging.details.eventId)
        }),
        paramsSchema: eventRegistrationSchemas.params.readPageDetailed,
        operation: async ({ prisma, params }) => {
            const segment = await queueSegmentFilter(prisma, params.paging.details)
            if (!segment) return []

            return await prisma.eventRegistration.findMany({
                ...cursorPagingSelection(params.paging.page),
                where: segment,
                orderBy: eventRegistrationQueueOrder,
                select: eventRegistrationSelectionDetailed,
            })
        }
    }),

    updateNotes: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.updateNotes(
            await registrationOwnerAndEventVisibility(prisma, params.registrationId)
        ),
        paramsSchema: eventRegistrationSchemas.params.updateNotes,
        dataSchema: eventRegistrationSchemas.data.updateNotes,
        operation: async ({ prisma, params, data }) => {
            const registration = await prisma.eventRegistration.findUniqueOrThrow({
                where: {
                    id: params.registrationId,
                },
                select: {
                    event: true,
                },
            })

            if (registration.event.registrationEnd < new Date()) {
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

    /**
     * Unregisters. When the registration held a place and someone queued on the waiting list, the
     * first of them takes the place and is told so once the change is saved. The event is locked
     * while the queue changes, so a registration arriving at the same time cannot be skipped.
     */
    destroy: defineOperation({
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.destroy(
            await registrationOwnerAndEventVisibility(prisma, params.registrationId)
        ),
        paramsSchema: eventRegistrationSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params, session }) => {
            const { eventId } = await prisma.eventRegistration.findUniqueOrThrow({
                where: { id: params.registrationId },
                select: { eventId: true },
            })
            const isAdmin = await sessionAdministratesEvent(prisma, session, eventId)

            const promoted = await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                const registration = await tx.eventRegistration.findUniqueOrThrow({
                    where: { id: params.registrationId },
                    select: {
                        id: true,
                        eventId: true,
                        event: { select: { name: true, places: true, registrationEnd: true } },
                    },
                })

                if (registration.event.registrationEnd < new Date() && !isAdmin) {
                    throw new Smorekopp(
                        'BAD PARAMETERS',
                        'Kan ikke avregistrere etter påmeldingsfristen. Ta kontakt med de som arrangerer.'
                    )
                }

                const heldPlace = await queuePosition(tx, registration) < registration.event.places
                await tx.eventRegistration.delete({
                    where: {
                        id: params.registrationId,
                    },
                })
                if (!heldPlace) return null

                // The first one past the places, now that this one is gone, has taken its place.
                const nextInLine = await tx.eventRegistration.findFirst({
                    where: {
                        eventId: registration.eventId,
                    },
                    skip: registration.event.places - 1,
                    orderBy: eventRegistrationQueueOrder,
                    include: {
                        contact: true,
                    }
                })
                return nextInLine ? { eventName: registration.event.name, nextInLine } : null
            })

            if (promoted) {
                await notifyPromotedFromWaitingList(promoted.eventName, [promoted.nextInLine])
            }
        }
    }),

    /**
     * Someone not registered is turned away rather than registered on the spot. A second scan leaves
     * the first one standing, and says so in `alreadyAttended`.
     */
    registerAttendance: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.registerAttendance,
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.registerAttendance.data({
            visibility: await eventVisibility(prisma, params.eventId),
            userId: params.registeredById,
        }),
        operation: async ({ prisma, params }): Promise<EventAttendanceScan> => {
            const existing = await prisma.eventRegistration.findUnique({
                where: {
                    eventId_userId: {
                        eventId: params.eventId,
                        userId: params.userId,
                    },
                },
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
            visibility: (await registrationOwnerAndEventVisibility(prisma, params.registrationId)).doubleLevelMatrix,
            userId: params.registeredById,
        }),
        operation: async ({ prisma, params, data }): Promise<EventAttendanceRegistration> =>
            await writeAttendance(prisma, params.registrationId, data.attended, params.registeredById),
    }),

    readAttendanceCounts: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.readAttendanceCounts,
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readAttendanceCounts.data({
            visibility: await eventVisibility(prisma, params.eventId),
        }),
        operation: async ({ prisma, params }): Promise<EventAttendanceCounts> =>
            await countAttendance(prisma, params.eventId),
    }),

    /**
     * The registrations on the places of the event whose user did not show up - the ones dots for
     * not showing up go to. Guests have no user to give a dot, and the waiting list never had a
     * place to show up to.
     */
    readNotAttended: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.readNotAttended,
        authorizer: async ({ params, prisma }) => eventRegistrationAuth.readNotAttended.data({
            visibility: await eventVisibility(prisma, params.eventId),
        }),
        operation: async ({ prisma, params }): Promise<EventRegistrationNotAttended[]> => {
            const boundary = await firstOnWaitingList(prisma, params.eventId)
            const registrations = await prisma.eventRegistration.findMany({
                where: {
                    eventId: params.eventId,
                    attendedAt: null,
                    userId: { not: null },
                    ...(boundary ? { id: { lt: boundary } } : {}),
                },
                orderBy: eventRegistrationQueueOrder,
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
            visibility: await eventVisibility(prisma, implementationParams.eventId),
            userId: params.accuserId,
        }),
        ownershipCheck: async ({ implementationParams, data, prisma }) =>
            await allRegistered(prisma, implementationParams.eventId, [data.userId]),
        operationImplementationFields: async ({ implementationParams, prisma }) => ({
            reasonContext: await eventName(prisma, implementationParams.eventId),
        }),
    }),

    /**
     * Gives everyone in the list a dot of the same value, as `createDot` does for one - meant for
     * those who did not show up (see `readNotAttended`). The value is capped, since this hands out
     * dots by the dozen.
     */
    createDotsForMany: dotOperations.internal.createManyInternal.implement({
        implementationParamsSchema: eventRegistrationSchemas.params.createDotsForMany,
        authorizer: async ({ implementationParams, params, prisma }) =>
            eventRegistrationAuth.createDotsForMany.data({
                visibility: await eventVisibility(prisma, implementationParams.eventId),
                userId: params.accuserId,
            }),
        ownershipCheck: async ({ implementationParams, data, prisma }) =>
            await allRegistered(prisma, implementationParams.eventId, data.userIds),
        beforeRun: ({ data }) => {
            if (data.value > maxDotsForNotShowingUp) {
                throw new Smorekopp('BAD DATA', `Kan gi høyst ${maxDotsForNotShowingUp} prikker om gangen.`)
            }
        },
        operationImplementationFields: async ({ implementationParams, prisma }) => ({
            reasonContext: await eventName(prisma, implementationParams.eventId),
        }),
    }),

    /**
     * Pays for a registration created separately via `create`/`createGuest`. Never creates a
     * registration itself. Supports paying part of the price from the payer's own ledger
     * balance (`amountFromBalance`) and the rest (`shortfall`) via `provider`; `provider` is
     * only required when the balance doesn't cover the full price.
     */
    createPayment: defineOperation({
        paramsSchema: eventRegistrationSchemas.params.createPayment,
        authorizer: ({ params }) => eventRegistrationAuth.createPayment.data({ userId: params.userId }),
        opensTransaction: true,
        operation: async ({ prisma, params }): Promise<{ payment: ExpandedPayment | null }> => {
            const registration = await prisma.eventRegistration.findUnique({
                where: {
                    eventId_userId: {
                        eventId: params.eventId,
                        userId: params.userId,
                    },
                },
                include: { event: true },
            })

            if (!registration) {
                throw new Smorekopp('NOT FOUND', 'Fant ingen påmelding å betale for.')
            }

            const { event } = registration

            if (!event.price) {
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

            const funds = event.price
            if (params.amountFromBalance > funds) {
                throw new Smorekopp('BAD PARAMETERS', 'Beløpet fra kontosaldo kan ikke overstige prisen.')
            }
            const shortfall = funds - params.amountFromBalance

            if (shortfall > 0 && !params.provider) {
                throw new Smorekopp('BAD PARAMETERS', 'Betalingsmetode må oppgis.')
            }

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
                    const isStale = Date.now() - existingAttempt.createdAt.getTime() > stalePendingTransactionMs
                    if (!isStale) {
                        throw new Smorekopp('BAD PARAMETERS', 'Denne påmeldingen har allerede en betaling under behandling.')
                    }
                    // Stale (likely abandoned) attempt - cancel it (also cancels any Stripe payment
                    // intent, so a late webhook for it can never complete) and let this one proceed.
                    // Bypassed: the outer authorizer already established this caller may pay for
                    // this registration, which is the right bar for canceling a stale attempt on it.
                    await ledgerTransactionOperations.cancel({
                        params: { id: existingAttempt.id },
                        bypassAuth: true,
                        prisma: tx,
                    })
                }

                let paymentId: number | undefined

                if (shortfall > 0) {
                    const payment = await paymentOperations.create({
                        params: {
                            provider: params.provider!,
                            funds: shortfall,
                            manualFees: params.manualFees,
                            descriptionLong: `Betaling for påmelding til ${event.name}`,
                            descriptionShort: 'Arrangement',
                        },
                        prisma: tx,
                    })
                    paymentId = payment.id
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
                        paymentId,
                        eventRegistrationId: registration.id,
                        description: params.provider === 'MANUAL' ? params.description : undefined,
                    },
                    prisma: tx,
                })
            })

            let payment = transaction.payment
            if (payment?.state === 'PENDING') {
                payment = await paymentOperations.initiate({
                    params: { paymentId: payment.id },
                })
            }

            return { payment }
        },
    }),
} as const

/**
 * The visibility levels of one event - the regular level is what it takes to register for it, the
 * admin level what it takes to act on the registrations of everyone else.
 */
async function eventVisibility(prisma: PrismaPossibleTransaction<false>, eventId: number) {
    return await eventOperations.visibility.readDoubleLevelMatrixInternal({
        params: { id: eventId },
        prisma,
    })
}

/**
 * The same levels, and whether the event is published: registering for a draft, or reading who is
 * registered to it, takes its admin level until it is published.
 */
async function eventVisibilityAndPublished(prisma: PrismaPossibleTransaction<false>, eventId: number) {
    const [visibility, event] = await Promise.all([
        eventVisibility(prisma, eventId),
        prisma.event.findUniqueOrThrow({
            where: { id: eventId },
            select: { published: true },
        }),
    ])
    return { visibility, published: event.published }
}

/**
 * Whether the session administrates one event - what lets it unregister anyone after the
 * registration deadline.
 */
async function sessionAdministratesEvent(
    prisma: PrismaPossibleTransaction<false>,
    session: SessionMaybeUser,
    eventId: number
) {
    return eventAdminLevel.data({ visibility: await eventVisibility(prisma, eventId) }).auth(session).authorized
}

/**
 * The same levels for the event one registration belongs to, together with the user that owns the
 * registration - null for a guest registered by an administrator.
 */
async function registrationOwnerAndEventVisibility(
    prisma: PrismaPossibleTransaction<false>,
    registrationId: number
) {
    const registration = await prisma.eventRegistration.findUniqueOrThrow({
        where: { id: registrationId },
        select: { userId: true, eventId: true },
    })
    return {
        userId: registration.userId,
        doubleLevelMatrix: await eventVisibility(prisma, registration.eventId),
    }
}

/**
 * Checks the dots of the user registering: dots either hold the user back until a while after the
 * ordinary registration start of the event, or ban them from registering at all.
 *
 * @param registrationStart - The ordinary registration start of the event. A timeout counts from it.
 * @param userId - The user being registered.
 * @param isAdmin - Admins register on behalf of others, and are not held back by the dots of anyone.
 */
async function validateDotPunishmentOfRegistration(
    prisma: Prisma.TransactionClient,
    registrationStart: Date,
    userId: number,
    isAdmin: boolean
) {
    if (isAdmin) return

    const punishment = await readDotPunishmentOfUser({
        params: { userId },
        prisma,
        bypassAuth: true,
    })

    if (punishment.type === 'ban') {
        throw new Smorekopp('BAD PARAMETERS', 'Du har for mange prikker til å melde deg på arrangementer.')
    }

    if (punishment.type === 'none') return

    const startForUser = new Date(registrationStart.getTime() + punishment.punishmentMinutes * 60 * 1000)

    if (startForUser > new Date()) {
        throw new Smorekopp(
            'BAD PARAMETERS',
            `Du har prikker, og kan derfor først melde deg på ${displayDate(startForUser)}.`
        )
    }
}

/**
 * Locks the event and checks it takes a registration now: it takes registrations at all, the
 * registration period is open (administrators may register outside it), and it has a place or a
 * waiting list left. Run it in the transaction that creates the registration, so two registrations
 * cannot both take the last place.
 *
 * @returns The event, with how many registrations it had before this one.
 */
async function lockEventOpenForRegistration(
    tx: Prisma.TransactionClient,
    eventId: number,
    isAdmin: boolean
) {
    await lockEvent(tx, eventId)
    const event = await tx.event.findUniqueOrThrow({
        where: {
            id: eventId
        },
        include: {
            _count: {
                select: {
                    eventRegistrations: true,
                },
            },
        },
    })

    if (!event.takesRegistration) {
        throw new Smorekopp('BAD PARAMETERS', 'Cannot register for an event without registration')
    }

    if (event.registrationStart > new Date() && !isAdmin) {
        throw new Smorekopp('BAD PARAMETERS', 'Cannot register for an event before the registration period.')
    }

    if (event.registrationEnd < new Date() && !isAdmin) {
        throw new Smorekopp('BAD PARAMETERS', 'Cannot register for an event after the registration period.')
    }

    if (event.places <= event._count.eventRegistrations && !event.waitingList) {
        throw new Smorekopp('BAD PARAMETERS', 'The event is full.')
    }

    return event
}

async function countAttendance(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number
): Promise<EventAttendanceCounts> {
    const boundary = await firstOnWaitingList(prisma, eventId)
    const onThePlaces = boundary ? { eventId, id: { lt: boundary } } : { eventId }

    const [attended, total, attendedFromWaitingList] = await Promise.all([
        prisma.eventRegistration.count({ where: { ...onThePlaces, attendedAt: { not: null } } }),
        prisma.eventRegistration.count({ where: onThePlaces }),
        boundary
            ? prisma.eventRegistration.count({
                where: { eventId, id: { gte: boundary }, attendedAt: { not: null } },
            })
            : 0,
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

/**
 * Whether every one of the users is registered to the event - what makes a dot for the event
 * theirs to get. Each user registers once per event, so the count of registrations says it.
 */
async function allRegistered(prisma: PrismaPossibleTransaction<false>, eventId: number, userIds: number[]) {
    const uniqueUserIds = Array.from(new Set(userIds))
    const registered = await prisma.eventRegistration.count({
        where: { eventId, userId: { in: uniqueUserIds } },
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
