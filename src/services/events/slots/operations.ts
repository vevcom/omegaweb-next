import '@ow-server-only'
import { eventSlotSchemas } from './schemas'
import { slotsOfSchedule } from './schedule'
import { slotScheduleSelection } from './constants'
import { eventSlotAuth } from './auth'
import { readEventAccess } from '@/services/events/access'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { registrantName } from '@/services/events/registration/registrantName'
import { registrationsOfVariant, waitingInVariant } from '@/services/events/registration/queue'
import { eventRegistrationQueueOrder } from '@/services/events/registration/constants'
import { changedFields } from '@/lib/changedFields'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import type { Slot, SlotBoard, SlotChange, SlotOfVariant } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { z } from 'zod'

function sameSlots(saved: Slot[], given: Slot[]) {
    return saved.length === given.length && saved.every((slot, index) => (
        slot.start.getTime() === given[index].start.getTime() && slot.end.getTime() === given[index].end.getTime()
    ))
}

type Placing = z.infer<typeof eventSlotSchemas.data.saveSchedule>['placing']

/**
 * Where a placing puts each who holds a slot: the new slot that starts when it says, or the waiting
 * list. It must name everyone who holds a slot once and no slot twice. One that names others than
 * those who hold a slot was made before someone registered or left.
 */
function placementsOf(
    holders: { id: number }[],
    slots: Slot[],
    placements: { registrationId: number, slotStart: Date | null }[],
) {
    const named = placements.map(placement => placement.registrationId)
    if (named.length !== new Set(named).size) {
        throw new ServiceError('BAD PARAMETERS', 'Noen er plassert to ganger.')
    }
    if (named.length !== holders.length || !holders.every(holder => named.includes(holder.id))) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Påmeldingene er endret siden skjemaet ble åpnet. Åpne det på nytt, og plasser dem igjen.'
        )
    }
    const placed = placements.map(({ registrationId, slotStart }) => {
        const slot = slotStart && slots.find(candidate => candidate.start.getTime() === slotStart.getTime())
        if (slot === undefined) throw new ServiceError('BAD PARAMETERS', 'Noen er plassert i en tidsluke som ikke finnes.')
        return { registrationId, slot }
    })
    const taken = placed.flatMap(placement => (placement.slot ? [placement.slot] : []))
    if (new Set(taken).size !== taken.length) {
        throw new ServiceError('BAD PARAMETERS', 'To er plassert i samme tidsluke.')
    }
    return placed
}

/**
 * Makes the schedule of a variant the one given, and holds its places to its slots: the quotas of
 * a slotted variant have as many places together as it has slots. A slotted variant has a schedule
 * and a list variant none.
 *
 * The slots are made again only when the schedule changes, so a schedule saved as it is keeps its
 * rows whatever `slotsOfSchedule` would make of it now. One that gives the same slots keeps their
 * rows too. One that gives other slots replaces them, and while anyone holds a slot it takes a
 * placing: each who holds one is put in a new slot or on the waiting list, keeping their place in
 * the queue, or everyone registered to the variant is removed. Returns what that did to each.
 *
 * Run it once the type and the quotas of the variant are saved, by whoever holds `lockEvent`, as
 * `eventVariantOperations.internal.saveSetup` does, and fix the places after it: the placing must
 * still stand once they are, see `eventOperations.saveSetup`.
 */
const saveSchedule = defineSubOperation({
    paramsSchema: () => eventSlotSchemas.params.saveSchedule,
    dataSchema: () => eventSlotSchemas.data.saveSchedule,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params: { variantId }, data: { schedule, placing } }): Promise<SlotChange[]> => {
        const variant = await prisma.eventVariant.findUniqueOrThrow({
            where: { id: variantId },
            select: {
                registrationType: true,
                slotSchedule: { select: slotScheduleSelection },
                quotas: { select: { places: true } },
            },
        })
        if (variant.registrationType === 'SLOTTED' && !schedule) {
            throw new ServiceError('BAD PARAMETERS', 'En variant med tidsluker må ha en timeplan.')
        }
        if (variant.registrationType === 'LIST' && schedule) {
            throw new ServiceError('BAD PARAMETERS', 'Bare en variant med tidsluker har en timeplan.')
        }

        const saved = variant.slotSchedule
        const changed = schedule && saved ? Object.keys(changedFields(saved, schedule)).length > 0 : schedule !== saved
        let changes: SlotChange[] = []
        if (changed) {
            const slots = schedule ? slotsOfSchedule(schedule) : []
            const savedSlots = await prisma.eventSlot.findMany({
                where: { variantId },
                select: { start: true, end: true },
                orderBy: { start: 'asc' },
            })
            if (!sameSlots(savedSlots, slots)) changes = await replaceSlots(prisma, variantId, slots, placing)
            if (schedule) {
                await prisma.eventSlotSchedule.upsert({
                    where: { variantId },
                    create: { variantId, ...schedule },
                    update: schedule,
                })
            } else {
                await prisma.eventSlotSchedule.delete({ where: { variantId } })
            }
        }

        if (!schedule) return changes
        const places = variant.quotas.reduce((sum, quota) => sum + quota.places, 0)
        const slotCount = await prisma.eventSlot.count({ where: { variantId } })
        if (places !== slotCount) {
            throw new ServiceError(
                'BAD PARAMETERS',
                `Kvotene har ${places} plasser til sammen, men det er ${slotCount} tidsluker. De må være like mange.`
            )
        }
        return changes
    },
})

/**
 * Refuses to remove everyone registered to the variant when they are others than those the form
 * knew, so that no one who came since is removed unseen. Run it under `lockEvent`.
 */
async function assertRemovingWhoWasConfirmed(prisma: Prisma.TransactionClient, variantId: number, confirmed: number[]) {
    const registrations = await prisma.eventRegistration.findMany({
        where: registrationsOfVariant(variantId),
        select: { id: true },
    })
    const known = new Set(confirmed)
    if (registrations.length !== known.size || registrations.some(({ id }) => !known.has(id))) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Påmeldingene er endret siden skjemaet ble åpnet. Åpne det på nytt, og se hvem som meldes av.'
        )
    }
}

/** A registration that is paid for, by hand or through the ledger. */
const hasPaid = {
    OR: [{ manuallyPaid: true }, { ledgerTransactions: { some: validTransactionFilter } }],
} as const satisfies Prisma.EventRegistrationWhereInput

/**
 * Replaces the slots of a variant with the ones given, and moves those who hold one as the placing
 * says. A held slot cannot be deleted, so every slot is let go before the old ones are deleted, and
 * those placed take theirs once the new ones are made.
 */
async function replaceSlots(
    prisma: Prisma.TransactionClient,
    variantId: number,
    slots: Slot[],
    placing: Placing,
): Promise<SlotChange[]> {
    const holders = (await prisma.eventRegistration.findMany({
        where: { slot: { variantId } },
        select: {
            id: true,
            userId: true,
            contact: { select: { email: true } },
            slot: { select: { start: true, end: true } },
        },
    })).flatMap(({ slot, ...holder }) => (slot ? [{ ...holder, slot }] : []))
    if (!placing && holders.length > 0) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Noen har tidsluker som ikke finnes i den nye timeplanen. Plasser dem i de nye tidslukene, eller meld av alle.'
        )
    }
    if (placing?.removeEveryone) await assertRemovingWhoWasConfirmed(prisma, variantId, placing.registrationIds)
    const removed = placing?.removeEveryone
        ? await eventRegistrationOperations.internal.destroyOfVariant.internalCall({ prisma, params: { variantId } })
        : []
    const placed = placing && !placing.removeEveryone ? placementsOf(holders, slots, placing.placements) : []
    const toWaitingList = placed.flatMap(placement => (placement.slot ? [] : [placement.registrationId]))
    // A place that is paid for is not taken back by a placing, as `fixVariantPlaces` keeps it too.
    if (await prisma.eventRegistration.count({ where: { id: { in: toWaitingList }, ...hasPaid } }) > 0) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Noen som har betalt for plassen sin, er satt på ventelisten. Gi dem en tidsluke, eller meld dem av, '
            + 'så de får pengene tilbake.'
        )
    }

    await eventRegistrationOperations.internal.releaseSlots.internalCall({
        prisma,
        params: { variantId },
        data: { toWaitingList },
    })
    await prisma.eventSlot.deleteMany({ where: { variantId } })
    const made = await prisma.eventSlot.createManyAndReturn({
        data: slots.map(slot => ({ variantId, ...slot })),
        select: { id: true, start: true },
    })
    await eventRegistrationOperations.internal.takeSlots.internalCall({
        prisma,
        params: { variantId },
        data: {
            placements: placed.flatMap(({ registrationId, slot }) => {
                const madeSlot = slot && made.find(candidate => candidate.start.getTime() === slot.start.getTime())
                return madeSlot ? [{ registrationId, slotId: madeSlot.id }] : []
            }),
        },
    })

    return [
        ...placed.map(({ registrationId, slot }) => {
            const { userId, contact, slot: before } = holders.find(holder => holder.id === registrationId)!
            return { registrationId, variantId, userId, contact, before, after: slot, removed: false }
        }),
        ...removed.map(({ id, userId, contact }) => ({
            registrationId: id,
            variantId,
            userId,
            contact,
            before: holders.find(holder => holder.id === id)?.slot ?? null,
            after: null,
            removed: true,
        })),
    ]
}

export const eventSlotOperations = {
    /** The slots of a variant in order, with which are free. A list variant has none. */
    readOfVariant: defineOperation({
        paramsSchema: eventSlotSchemas.params.readOfVariant,
        authorizer: async ({ params, prisma }) => {
            const { eventId } = await prisma.eventVariant.findUniqueOrThrow({
                where: { id: params.variantId },
                select: { eventId: true },
            })
            return eventSlotAuth.readOfVariant.data(await readEventAccess(prisma, eventId))
        },
        operation: async ({ prisma, params }): Promise<SlotOfVariant[]> => {
            const slots = await prisma.eventSlot.findMany({
                where: { variantId: params.variantId },
                orderBy: { start: 'asc' },
                select: { id: true, start: true, end: true, registration: { select: { id: true } } },
            })
            return slots.map(({ registration, ...slot }) => ({ ...slot, free: registration === null }))
        },
    }),

    /** The slots of a variant in order, with who holds each, for its administrators. */
    readBoard: defineOperation({
        paramsSchema: eventSlotSchemas.params.readBoard,
        authorizer: async ({ params, prisma }) => {
            const { eventId } = await prisma.eventVariant.findUniqueOrThrow({
                where: { id: params.variantId },
                select: { eventId: true },
            })
            return eventSlotAuth.readBoard.data(await readEventAccess(prisma, eventId))
        },
        operation: async ({ prisma, params }): Promise<SlotBoard> => {
            const slots = await prisma.eventSlot.findMany({
                where: { variantId: params.variantId },
                orderBy: { start: 'asc' },
                select: {
                    id: true,
                    start: true,
                    end: true,
                    registration: {
                        select: {
                            id: true,
                            user: { select: { firstname: true, lastname: true } },
                            contact: { select: { name: true } },
                            manuallyPaid: true,
                            ledgerTransactions: { where: validTransactionFilter, select: { id: true }, take: 1 },
                        },
                    },
                },
            })
            const waiting = await prisma.eventRegistration.findMany({
                where: waitingInVariant(params.variantId),
                orderBy: eventRegistrationQueueOrder,
                select: { id: true },
            })
            return {
                slots: slots.map(({ registration, ...slot }) => ({
                    ...slot,
                    holder: registration && {
                        registrationId: registration.id,
                        name: registrantName(registration),
                        paid: registration.manuallyPaid || registration.ledgerTransactions.length > 0,
                    },
                })),
                waiting: waiting.map(({ id }) => id),
            }
        },
    }),

    internal: {
        saveSchedule,
    },
} as const
