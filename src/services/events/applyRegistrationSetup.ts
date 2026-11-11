import '@pn-server-only'
import { createQuota } from './quotas/createQuota'
import { assertValidVariant, createVariant, unpaidVariant } from './variants/createVariant'
import { ServiceError } from '@/services/error'
import { visibilityOperations } from '@/services/visibility/operations'
import type { eventSchemas } from './schemas'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { z } from 'zod'

type VariantSetup = NonNullable<z.infer<typeof eventSchemas.data.saveSetup>['variants']>[number]
type QuotaSetup = VariantSetup['quotas'][number]

async function destroyVisibilities(tx: Prisma.TransactionClient, visibilityIds: number[]) {
    await Promise.all(visibilityIds.map(visibilityId => visibilityOperations.destroy.internalCall({
        prisma: tx,
        params: { visibilityId },
    })))
}

async function saveQuotas(tx: Prisma.TransactionClient, variantId: number, quotas: QuotaSetup[]) {
    const existing = await tx.eventQuota.findMany({
        where: { variantId },
        select: { id: true, visibilityId: true, _count: { select: { registrations: true } } },
    })
    const removed = existing.filter(quota => !quotas.some(setup => setup.id === quota.id))
    if (removed.some(quota => quota._count.registrations > 0)) {
        throw new ServiceError('BAD PARAMETERS', 'Kvoten har påmeldte. Flytt eller meld av dem før du fjerner den.')
    }
    await tx.eventQuota.deleteMany({ where: { id: { in: removed.map(quota => quota.id) } } })
    await destroyVisibilities(tx, removed.map(quota => quota.visibilityId))

    for (let order = 0; order < quotas.length; order++) {
        const setup = quotas[order]
        const { id, ...fields } = setup
        const known = existing.find(quota => quota.id === id)
        if (id !== undefined && !known) throw new ServiceError('BAD PARAMETERS', 'Kvoten hører ikke til varianten.')

        const saved = known ?? await createQuota(tx, variantId, fields)
        await tx.eventQuota.update({
            where: { id: saved.id },
            data: { order, name: fields.name, places: fields.places },
        })
        if (known) {
            await visibilityOperations.updateInTransaction.internalCall({
                prisma: tx,
                params: { visibilityId: known.visibilityId },
                data: { requirements: fields.visibilityRequirements },
            })
        }
    }
}

/**
 * Makes the variants and quotas of an event what the setup says, in its order, and returns the ids
 * of the variants. Run it under `lockEvent`, in the caller's transaction, so that anything refused
 * along the way leaves the event as it was, and fix the places of the variants afterwards. What
 * the setup leaves out is removed, and the setup is refused if someone is registered there.
 */
export async function applyRegistrationSetup(
    tx: Prisma.TransactionClient,
    eventId: number,
    variants: VariantSetup[],
): Promise<number[]> {
    const existing = await tx.eventVariant.findMany({
        where: { eventId },
        select: {
            id: true,
            quotas: { select: { visibilityId: true, _count: { select: { registrations: true } } } },
            _count: { select: { waitingListRegistrations: true } },
        },
    })
    const removed = existing.filter(variant => !variants.some(setup => setup.id === variant.id))
    const registered = removed.some(variant => variant._count.waitingListRegistrations > 0
        || variant.quotas.some(quota => quota._count.registrations > 0))
    if (registered) {
        throw new ServiceError('BAD PARAMETERS', 'Varianten har påmeldte. Meld dem av før du fjerner den.')
    }
    await tx.eventVariant.deleteMany({ where: { id: { in: removed.map(variant => variant.id) } } })
    await destroyVisibilities(tx, removed.flatMap(variant => variant.quotas.map(quota => quota.visibilityId)))

    const savedIds: number[] = []
    for (let order = 0; order < variants.length; order++) {
        const setup = variants[order]
        const { id, quotas, ...fields } = setup
        if (id !== undefined && !existing.some(variant => variant.id === id)) {
            throw new ServiceError('BAD PARAMETERS', 'Varianten hører ikke til arrangementet.')
        }
        const saved = id === undefined
            ? await createVariant(tx, eventId, fields)
            : { id }
        assertValidVariant(fields)
        await tx.eventVariant.update({
            where: { id: saved.id },
            data: { ...fields, order, ...(fields.takesPayment ? {} : unpaidVariant) },
        })
        await saveQuotas(tx, saved.id, quotas)
        savedIds.push(saved.id)
    }

    return savedIds
}
