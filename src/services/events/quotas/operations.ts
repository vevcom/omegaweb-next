import '@pn-server-only'
import { eventQuotaAuth } from './auth'
import { eventQuotaSchemas } from './schemas'
import { createQuota } from './createQuota'
import { assertSeenThroughQuotas, readEventAccess, readEventIdOfQuota, readEventIdOfVariant } from '@/services/events/access'
import { eventQuotaOrder, eventQuotaSummarySelection } from '@/services/events/constants'
import { lockEvent } from '@/services/events/registration/queue'
import { fixVariantPlaces, notifyPromoted } from '@/services/events/registration/fixState'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementVisibilityOperations, toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventQuotaExpanded } from './types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** Refills the places of the variant a quota belongs to, after a change to the quota, and tells the promoted. */
async function refillVariantOfQuota(prisma: PrismaPossibleTransaction<true>, quotaId: number) {
    const quota = await prisma.eventQuota.findUniqueOrThrow({
        where: { id: quotaId },
        select: { variantId: true, variant: { select: { eventId: true } } },
    })
    const promoted = await prisma.$transaction(async tx => {
        await lockEvent(tx, quota.variant.eventId)
        return await fixVariantPlaces(tx, quota.variantId)
    })
    await notifyPromoted(prisma, quota.variant.eventId, promoted)
}

const visibility = implementVisibilityOperations({
    implementationParamsSchema: eventQuotaSchemas.params.visibility,
    authorizers: {
        readMatrix: async ({ prisma, params }) => eventQuotaAuth.readVisibility.data(
            await readEventAccess(prisma, await readEventIdOfQuota(prisma, params.id))
        ),
        update: async ({ prisma, implementationParams }) => eventQuotaAuth.updateVisibility.data(
            await readEventAccess(prisma, await readEventIdOfQuota(prisma, implementationParams.id))
        ),
    },
    readVisibility: async ({ prisma, implementationParams, include }) => (
        await prisma.eventQuota.findUniqueOrThrow({
            where: { id: implementationParams.id },
            select: { visibility: { include } },
        })
    ).visibility,
    emptyMeans: 'EVERYONE',
    afterUpdate: ({ prisma, implementationParams }) => refillVariantOfQuota(prisma, implementationParams.id),
})

export const eventQuotaOperations = {
    visibility,

    readMany: defineOperation({
        paramsSchema: eventQuotaSchemas.params.readMany,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.readMany.data(
            await readEventAccess(prisma, await readEventIdOfVariant(prisma, params.variantId))
        ),
        operation: async ({ prisma, params }): Promise<EventQuotaExpanded[]> => {
            const quotas = await prisma.eventQuota.findMany({
                where: { variantId: params.variantId },
                select: {
                    ...eventQuotaSummarySelection,
                    visibility: { include: visibilityIncluder },
                },
                orderBy: eventQuotaOrder,
            })
            return quotas.map(({ _count, visibility: quotaVisibility, ...quota }) => ({
                ...quota,
                numOfRegistrations: _count.registrations,
                visibility: toMatrix(quotaVisibility),
            }))
        },
    }),

    create: defineOperation({
        paramsSchema: eventQuotaSchemas.params.create,
        dataSchema: eventQuotaSchemas.data.create,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.create.data(
            await readEventAccess(prisma, await readEventIdOfVariant(prisma, params.variantId))
        ),
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) => {
            const eventId = await readEventIdOfVariant(prisma, params.variantId)
            const { quota, promoted } = await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                const created = await createQuota(tx, params.variantId, data)
                return { quota: created, promoted: await fixVariantPlaces(tx, params.variantId) }
            })
            await notifyPromoted(prisma, eventId, promoted)
            return quota
        },
    }),

    update: defineOperation({
        paramsSchema: eventQuotaSchemas.params.update,
        dataSchema: eventQuotaSchemas.data.update,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.update.data(
            await readEventAccess(prisma, await readEventIdOfQuota(prisma, params.id))
        ),
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) => {
            const quota = await prisma.eventQuota.findUniqueOrThrow({
                where: { id: params.id },
                select: { variantId: true, variant: { select: { eventId: true } } },
            })
            const { updated, promoted } = await prisma.$transaction(async tx => {
                await lockEvent(tx, quota.variant.eventId)
                const updatedQuota = await tx.eventQuota.update({ where: { id: params.id }, data })
                return { updated: updatedQuota, promoted: await fixVariantPlaces(tx, quota.variantId) }
            })
            await notifyPromoted(prisma, quota.variant.eventId, promoted)
            return updated
        },
    }),

    destroy: defineOperation({
        paramsSchema: eventQuotaSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.destroy.data(
            await readEventAccess(prisma, await readEventIdOfQuota(prisma, params.id))
        ),
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params }) => {
            const quota = await prisma.eventQuota.findUniqueOrThrow({
                where: { id: params.id },
                select: {
                    visibilityId: true,
                    variant: { select: { eventId: true } },
                    _count: { select: { registrations: true } },
                },
            })
            if (quota._count.registrations > 0) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Kvoten har påmeldte. Flytt eller meld av dem før du fjerner den.'
                )
            }

            await prisma.eventQuota.delete({ where: { id: params.id } })
            await visibilityOperations.destroy.internalCall({
                prisma,
                params: { visibilityId: quota.visibilityId },
            })
            await assertSeenThroughQuotas(prisma, quota.variant.eventId)
        },
    }),

    reorder: defineOperation({
        paramsSchema: eventQuotaSchemas.params.reorder,
        dataSchema: eventQuotaSchemas.data.reorder,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.reorder.data(
            await readEventAccess(prisma, await readEventIdOfVariant(prisma, params.variantId))
        ),
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) => {
            const eventId = await readEventIdOfVariant(prisma, params.variantId)
            const promoted = await prisma.$transaction(async tx => {
                await lockEvent(tx, eventId)
                const quotas = await tx.eventQuota.findMany({
                    where: { variantId: params.variantId },
                    select: { id: true },
                })
                const given = new Set(data.quotaIds)
                if (given.size !== data.quotaIds.length || given.size !== quotas.length
                    || !quotas.every(quota => given.has(quota.id))) {
                    throw new ServiceError('BAD PARAMETERS', 'Rekkefølgen må nevne hver kvote i varianten én gang.')
                }

                await Promise.all(data.quotaIds.map((quotaId, order) => tx.eventQuota.update({
                    where: { id: quotaId },
                    data: { order },
                })))
                return await fixVariantPlaces(tx, params.variantId)
            })
            await notifyPromoted(prisma, eventId, promoted)
        },
    }),
} as const
