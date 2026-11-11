import '@pn-server-only'
import { eventQuotaAuth } from './auth'
import { eventQuotaSchemas } from './schemas'
import { readEventAccess, readEventIdOfQuota, readEventIdOfVariant } from '@/services/events/access'
import { eventQuotaOrder, eventQuotaSummarySelection } from '@/services/events/constants'
import { changedFields } from '@/lib/changedFields'
import { ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementVisibilityRead, toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventQuotaExpanded } from './types'

// Who may register through a quota is changed with the quota, by saving the event's setup.
const visibility = implementVisibilityRead({
    implementationParamsSchema: eventQuotaSchemas.params.visibility,
    authorizer: async ({ prisma, params }) => eventQuotaAuth.readVisibility.data(
        await readEventAccess(prisma, await readEventIdOfQuota(prisma, params.id))
    ),
    readVisibility: async ({ prisma, implementationParams, include }) => (
        await prisma.eventQuota.findUniqueOrThrow({
            where: { id: implementationParams.id },
            select: { visibility: { include } },
        })
    ).visibility,
})

/*
 * The writes of the quotas. They change the quotas and nothing else: whoever calls them holds
 * `lockEvent` and puts the registrations where they then belong once it is done, and checks that
 * the event is still seen by someone. `eventOperations.saveSetup` does.
 */

/** Creates a quota with its visibility, last in the fill order of its variant. */
const create = defineSubOperation({
    paramsSchema: () => eventQuotaSchemas.params.create,
    dataSchema: () => eventQuotaSchemas.data.create,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data }) => {
        const last = await prisma.eventQuota.findFirst({
            where: { variantId: params.variantId },
            orderBy: { order: 'desc' },
            select: { order: true },
        })
        const quotaVisibility = await visibilityOperations.createWithRequirements.internalCall({
            prisma,
            data: { requirements: data.visibilityRequirements },
        })

        return await prisma.eventQuota.create({
            data: {
                variantId: params.variantId,
                order: (last?.order ?? -1) + 1,
                name: data.name,
                places: data.places,
                visibilityId: quotaVisibility.id,
            },
        })
    },
})

/** Changes the name and the places of a quota, and who may register through it when that is given. */
const update = defineSubOperation({
    paramsSchema: () => eventQuotaSchemas.params.update,
    dataSchema: () => eventQuotaSchemas.data.update,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data: { visibilityRequirements, ...fields } }) => {
        const quota = await prisma.eventQuota.update({ where: { id: params.id }, data: fields })
        if (visibilityRequirements) {
            await visibilityOperations.update.internalCall({
                prisma,
                params: { visibilityId: quota.visibilityId },
                data: { requirements: visibilityRequirements },
            })
        }
        return quota
    },
})

/** Removes a quota and its visibility, once no one is registered through it. */
const destroy = defineSubOperation({
    paramsSchema: () => eventQuotaSchemas.params.destroy,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params }) => {
        const quota = await prisma.eventQuota.findUniqueOrThrow({
            where: { id: params.id },
            select: { visibilityId: true, _count: { select: { registrations: true } } },
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
    },
})

/** Puts the quotas of a variant in the fill order given, which must name each of them once. */
const reorder = defineSubOperation({
    paramsSchema: () => eventQuotaSchemas.params.reorder,
    dataSchema: () => eventQuotaSchemas.data.reorder,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data }) => {
        const quotas = await prisma.eventQuota.findMany({
            where: { variantId: params.variantId },
            select: { id: true, order: true },
        })
        const given = new Set(data.quotaIds)
        if (given.size !== data.quotaIds.length || given.size !== quotas.length
            || !quotas.every(quota => given.has(quota.id))) {
            throw new ServiceError('BAD PARAMETERS', 'Rekkefølgen må nevne hver kvote i varianten én gang.')
        }

        const moved = data.quotaIds
            .map((quotaId, order) => ({ quotaId, order }))
            .filter(({ quotaId, order }) => quotas.find(quota => quota.id === quotaId)?.order !== order)
        await Promise.all(moved.map(({ quotaId, order }) => prisma.eventQuota.update({
            where: { id: quotaId },
            data: { order },
        })))
    },
})

/**
 * Makes the quotas of a variant the ones given, in the order given: creates those without an id,
 * changes those with one and removes the ones left out, which is refused for a quota someone is
 * registered through. A quota given as it is already is left alone.
 */
const saveSetup = defineSubOperation({
    paramsSchema: () => eventQuotaSchemas.params.saveSetup,
    dataSchema: () => eventQuotaSchemas.data.saveSetup,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data }) => {
        const existing = await prisma.eventQuota.findMany({
            where: { variantId: params.variantId },
            select: { id: true, name: true, places: true },
        })
        const keptIds = data.quotas.flatMap(quota => (quota.id === undefined ? [] : [quota.id]))
        if (!keptIds.every(id => existing.some(quota => quota.id === id))) {
            throw new ServiceError('BAD PARAMETERS', 'Kvoten hører ikke til varianten.')
        }

        for (const quota of existing) {
            if (!keptIds.includes(quota.id)) await destroy.internalCall({ prisma, params: { id: quota.id } })
        }
        const quotaIds: number[] = []
        for (const { id, ...fields } of data.quotas) {
            const known = existing.find(quota => quota.id === id)
            if (!known) {
                quotaIds.push((await create.internalCall({ prisma, params, data: fields })).id)
            } else {
                const { visibilityRequirements, ...row } = fields
                // The visibility tells for itself whether its requirements are the ones given.
                await update.internalCall({
                    prisma,
                    params: { id: known.id },
                    data: { ...changedFields(known, row), visibilityRequirements },
                })
                quotaIds.push(known.id)
            }
        }
        await reorder.internalCall({ prisma, params, data: { quotaIds } })
    },
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

    internal: {
        create,
        update,
        destroy,
        reorder,
        saveSetup,
    },
} as const
