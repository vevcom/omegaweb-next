import '@pn-server-only'
import { eventVariantAuth } from './auth'
import { eventVariantSchemas } from './schemas'
import { readEventAccess } from '@/services/events/access'
import { eventQuotaOrder, eventVariantOrder, eventVariantSummarySelection } from '@/services/events/constants'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { registrationsOfVariant } from '@/services/events/registration/queue'
import { changedFields } from '@/lib/changedFields'
import { ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventVariantExpanded } from './types'

type VariantPeriods = {
    registrationStart: Date,
    registrationEnd: Date,
    takesPayment: boolean,
    price?: number | null,
    paymentStart?: Date | null,
    paymentEnd?: Date | null,
}

/** Passes the values the variant will have, so a partial update is judged whole. */
function assertValidVariant(variant: VariantPeriods) {
    if (variant.registrationStart > variant.registrationEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Påmeldingen må jo starte før den slutter')
    }
    if (!variant.takesPayment) return
    if (!variant.price) {
        throw new ServiceError('BAD PARAMETERS', 'En variant som tar betaling må ha en pris')
    }
    if (!variant.paymentStart || !variant.paymentEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Betalingsdatoer må settes når varianten tar betaling')
    }
    if (variant.paymentStart > variant.paymentEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Betalingen må jo starte før den slutter')
    }
}

/** What a variant that does not take payment holds in the payment fields. */
const unpaidVariant = { price: null, paymentStart: null, paymentEnd: null, requeueUnpaidRegistrations: false }

/*
 * The writes of the variants. They change the variants and their quotas and nothing else: whoever
 * calls them holds `lockEvent` and puts the registrations where they then belong once it is done,
 * and checks that the event is still seen by someone. `eventOperations.saveSetup` does.
 */

/** Creates a variant last in the order of its event. */
const create = defineSubOperation({
    paramsSchema: () => eventVariantSchemas.params.create,
    dataSchema: () => eventVariantSchemas.data.create,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data }) => {
        assertValidVariant(data)
        const last = await prisma.eventVariant.findFirst({
            where: { eventId: params.eventId },
            orderBy: { order: 'desc' },
            select: { order: true },
        })
        return await prisma.eventVariant.create({
            data: {
                eventId: params.eventId,
                order: (last?.order ?? -1) + 1,
                name: data.name,
                registrationStart: data.registrationStart,
                registrationEnd: data.registrationEnd,
                takesPayment: data.takesPayment,
                ...(data.takesPayment
                    ? {
                        price: data.price,
                        paymentStart: data.paymentStart,
                        paymentEnd: data.paymentEnd,
                        requeueUnpaidRegistrations: data.requeueUnpaidRegistrations,
                    }
                    : unpaidVariant),
            },
        })
    },
})

/** Changes a variant. One that ends up taking no payment loses its price and payment period. */
const update = defineSubOperation({
    paramsSchema: () => eventVariantSchemas.params.update,
    dataSchema: () => eventVariantSchemas.data.update,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data }) => {
        const variant = await prisma.eventVariant.findUniqueOrThrow({ where: { id: params.id } })
        const resulting = { ...variant, ...data }
        assertValidVariant(resulting)

        return await prisma.eventVariant.update({
            where: { id: params.id },
            data: {
                ...data,
                ...(resulting.takesPayment ? {} : unpaidVariant),
            },
        })
    },
})

/** Removes a variant and its quotas, once no one is registered to it or waiting for it. */
const destroy = defineSubOperation({
    paramsSchema: () => eventVariantSchemas.params.destroy,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params }) => {
        const variant = await prisma.eventVariant.findUniqueOrThrow({
            where: { id: params.id },
            select: { quotas: { select: { id: true } } },
        })
        if (await prisma.eventRegistration.count({ where: registrationsOfVariant(params.id) }) > 0) {
            throw new ServiceError('BAD PARAMETERS', 'Varianten har påmeldte. Meld dem av før du fjerner den.')
        }

        for (const quota of variant.quotas) {
            await eventQuotaOperations.internal.destroy.internalCall({ prisma, params: { id: quota.id } })
        }
        await prisma.eventVariant.delete({ where: { id: params.id } })
    },
})

/** Puts the variants of an event in the order given, which must name each of them once. */
const reorder = defineSubOperation({
    paramsSchema: () => eventVariantSchemas.params.reorder,
    dataSchema: () => eventVariantSchemas.data.reorder,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data }) => {
        const variants = await prisma.eventVariant.findMany({
            where: { eventId: params.eventId },
            select: { id: true, order: true },
        })
        const given = new Set(data.variantIds)
        if (given.size !== data.variantIds.length || given.size !== variants.length
            || !variants.every(variant => given.has(variant.id))) {
            throw new ServiceError('BAD PARAMETERS', 'Rekkefølgen må nevne hver variant i arrangementet én gang.')
        }

        const moved = data.variantIds
            .map((variantId, order) => ({ variantId, order }))
            .filter(({ variantId, order }) => variants.find(variant => variant.id === variantId)?.order !== order)
        await Promise.all(moved.map(({ variantId, order }) => prisma.eventVariant.update({
            where: { id: variantId },
            data: { order },
        })))
    },
})

/**
 * Makes the variants of an event the ones given, each with the quotas given, in the order given:
 * creates those without an id, changes those with one and removes the ones left out, which is
 * refused where someone is registered. A variant given as it is already is left alone. Returns
 * the ids of the variants, in order.
 */
const saveSetup = defineSubOperation({
    paramsSchema: () => eventVariantSchemas.params.saveSetup,
    dataSchema: () => eventVariantSchemas.data.saveSetup,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params, data }): Promise<number[]> => {
        const existing = await prisma.eventVariant.findMany({ where: { eventId: params.eventId } })
        const keptIds = data.variants.flatMap(variant => (variant.id === undefined ? [] : [variant.id]))
        if (!keptIds.every(id => existing.some(variant => variant.id === id))) {
            throw new ServiceError('BAD PARAMETERS', 'Varianten hører ikke til arrangementet.')
        }

        for (const variant of existing) {
            if (!keptIds.includes(variant.id)) await destroy.internalCall({ prisma, params: { id: variant.id } })
        }
        const variantIds: number[] = []
        for (const { id, quotas, ...fields } of data.variants) {
            const known = existing.find(variant => variant.id === id)
            const changes = known ? changedFields(known, fields) : {}
            if (known && Object.keys(changes).length > 0) {
                await update.internalCall({ prisma, params: { id: known.id }, data: changes })
            }
            const variantId = known?.id ?? (await create.internalCall({ prisma, params, data: fields })).id
            await eventQuotaOperations.internal.saveSetup.internalCall({ prisma, params: { variantId }, data: { quotas } })
            variantIds.push(variantId)
        }
        await reorder.internalCall({ prisma, params, data: { variantIds } })
        return variantIds
    },
})

export const eventVariantOperations = {
    readMany: defineOperation({
        paramsSchema: eventVariantSchemas.params.readMany,
        authorizer: async ({ params, prisma }) => eventVariantAuth.readMany.data(
            await readEventAccess(prisma, params.eventId)
        ),
        operation: async ({ prisma, params }): Promise<EventVariantExpanded[]> => {
            const variants = await prisma.eventVariant.findMany({
                where: { eventId: params.eventId },
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
            })
            return variants.map(({ _count, quotas, ...variant }) => {
                const expanded = quotas.map(({ _count: quotaCount, visibility, ...quota }) => ({
                    ...quota,
                    numOfRegistrations: quotaCount.registrations,
                    visibility: toMatrix(visibility),
                }))
                return {
                    ...variant,
                    quotas: expanded,
                    takesRegistration: expanded.some(quota => quota.places > 0),
                    places: expanded.reduce((sum, quota) => sum + quota.places, 0),
                    numOfRegistrations: expanded.reduce((sum, quota) => sum + quota.numOfRegistrations, 0),
                    numOnWaitingList: _count.waitingListRegistrations,
                }
            })
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
