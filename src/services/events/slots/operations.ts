import '@ow-server-only'
import { eventSlotSchemas } from './schemas'
import { slotsOfSchedule } from './schedule'
import { slotScheduleSelection } from './constants'
import { registrationsOfVariant } from '@/services/events/registration/queue'
import { changedFields } from '@/lib/changedFields'
import { ServiceError } from '@/services/error'
import { defineSubOperation } from '@/services/serviceOperation'
import type { Slot } from './types'

function sameSlots(saved: Slot[], given: Slot[]) {
    return saved.length === given.length && saved.every((slot, index) => (
        slot.start.getTime() === given[index].start.getTime() && slot.end.getTime() === given[index].end.getTime()
    ))
}

/**
 * Makes the schedule of a variant the one given, and holds its places to its slots: the quotas of
 * a slotted variant have as many places together as it has slots. A slotted variant has a schedule
 * and a list variant none.
 *
 * The slots are made again only when the schedule changes, so a schedule saved as it is keeps its
 * rows whatever `slotsOfSchedule` would make of it now. A changed schedule that gives other slots
 * replaces them while no one is registered to the variant, and is refused while anyone is, those
 * waiting included. One that gives the same slots keeps their rows.
 *
 * Run it once the type and the quotas of the variant are saved, by whoever holds `lockEvent`, as
 * `eventVariantOperations.internal.saveSetup` does.
 */
const saveSchedule = defineSubOperation({
    paramsSchema: () => eventSlotSchemas.params.saveSchedule,
    dataSchema: () => eventSlotSchemas.data.saveSchedule,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params: { variantId }, data: { schedule } }) => {
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
        if (changed) {
            const slots = schedule ? slotsOfSchedule(schedule) : []
            const savedSlots = await prisma.eventSlot.findMany({
                where: { variantId },
                select: { start: true, end: true },
                orderBy: { start: 'asc' },
            })
            if (!sameSlots(savedSlots, slots)) {
                if (await prisma.eventRegistration.count({ where: registrationsOfVariant(variantId) }) > 0) {
                    throw new ServiceError(
                        'BAD PARAMETERS',
                        'Varianten har påmeldte, så tidslukene kan ikke endres. Meld dem av først.'
                    )
                }
                await prisma.eventSlot.deleteMany({ where: { variantId } })
                await prisma.eventSlot.createMany({ data: slots.map(slot => ({ variantId, ...slot })) })
            }
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

        if (!schedule) return
        const places = variant.quotas.reduce((sum, quota) => sum + quota.places, 0)
        const slotCount = await prisma.eventSlot.count({ where: { variantId } })
        if (places !== slotCount) {
            throw new ServiceError(
                'BAD PARAMETERS',
                `Kvotene har ${places} plasser til sammen, men det er ${slotCount} tidsluker. De må være like mange.`
            )
        }
    },
})

export const eventSlotOperations = {
    internal: {
        saveSchedule,
    },
} as const
