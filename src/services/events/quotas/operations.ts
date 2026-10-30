import '@pn-server-only'
import { eventQuotaAuth } from './auth'
import { eventQuotaSchemas } from './schemas'
import { assertValidQuota, createQuota } from './createQuota'
import { readEventAccess, readEventIdOfQuota } from '@/services/events/access'
import { eventQuotaOrder, eventQuotaSummarySelection } from '@/services/events/constants'
import { lockEvent } from '@/services/events/registration/queue'
import { promoteToQuota } from '@/services/events/registration/promote'
import { notifyPromotedFromWaitingList } from '@/services/events/registration/notifyPromotedFromWaitingList'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementVisibilityOperations, toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventQuotaExpanded } from './types'

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
        await prisma.eventRegistrationQuota.findUniqueOrThrow({
            where: { id: implementationParams.id },
            select: { visibility: { include } },
        })
    ).visibility,
    emptyMeans: 'EVERYONE',
})

export const eventQuotaOperations = {
    visibility,

    /** The quotas of an event in fill order, each with who may register through it. */
    readMany: defineOperation({
        paramsSchema: eventQuotaSchemas.params.readMany,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.readMany.data(
            await readEventAccess(prisma, params.eventId)
        ),
        operation: async ({ prisma, params }): Promise<EventQuotaExpanded[]> => {
            const quotas = await prisma.eventRegistrationQuota.findMany({
                where: { eventId: params.eventId },
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
            await readEventAccess(prisma, params.eventId)
        ),
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            const event = await prisma.event.findUniqueOrThrow({
                where: { id: params.eventId },
                select: { id: true, takesPayment: true },
            })
            return await prisma.$transaction(tx => createQuota(tx, event, data))
        },
    }),

    update: defineOperation({
        paramsSchema: eventQuotaSchemas.params.update,
        dataSchema: eventQuotaSchemas.data.update,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.update.data(
            await readEventAccess(prisma, await readEventIdOfQuota(prisma, params.id))
        ),
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            const quota = await prisma.eventRegistrationQuota.findUniqueOrThrow({
                where: { id: params.id },
                include: { event: { select: { id: true, name: true, takesPayment: true } } },
            })
            assertValidQuota({
                registrationStart: data.registrationStart ?? quota.registrationStart,
                registrationEnd: data.registrationEnd ?? quota.registrationEnd,
                price: data.price ?? quota.price,
            }, quota.event)

            const { updated, promoted } = await prisma.$transaction(async tx => {
                await lockEvent(tx, quota.eventId)
                const updatedQuota = await tx.eventRegistrationQuota.update({
                    where: { id: params.id },
                    data: {
                        ...data,
                        ...(quota.event.takesPayment ? {} : { price: null }),
                    },
                })
                // More places go to the first on the waiting list who pass the quota.
                const promotedRegistrations = updatedQuota.places > quota.places
                    ? await promoteToQuota(tx, quota.id)
                    : []
                return { updated: updatedQuota, promoted: promotedRegistrations }
            })

            if (promoted.length) {
                await notifyPromotedFromWaitingList(quota.event, promoted)
            }
            return updated
        },
    }),

    /** Removes an empty quota. One holding registrations keeps them until they are moved or unregistered. */
    destroy: defineOperation({
        paramsSchema: eventQuotaSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.destroy.data(
            await readEventAccess(prisma, await readEventIdOfQuota(prisma, params.id))
        ),
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            const quota = await prisma.eventRegistrationQuota.findUniqueOrThrow({
                where: { id: params.id },
                select: { visibilityId: true, _count: { select: { registrations: true } } },
            })
            if (quota._count.registrations > 0) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Kvoten har påmeldte. Flytt eller meld av dem før du fjerner den.'
                )
            }

            await prisma.$transaction(async tx => {
                await tx.eventRegistrationQuota.delete({ where: { id: params.id } })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: quota.visibilityId },
                })
            })
        },
    }),

    /** Sets the fill order of the quotas of an event. Every quota of the event must be given, once. */
    reorder: defineOperation({
        paramsSchema: eventQuotaSchemas.params.reorder,
        dataSchema: eventQuotaSchemas.data.reorder,
        authorizer: async ({ params, prisma }) => eventQuotaAuth.reorder.data(
            await readEventAccess(prisma, params.eventId)
        ),
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            await prisma.$transaction(async tx => {
                await lockEvent(tx, params.eventId)
                const quotas = await tx.eventRegistrationQuota.findMany({
                    where: { eventId: params.eventId },
                    select: { id: true },
                })
                const given = new Set(data.quotaIds)
                if (given.size !== data.quotaIds.length || given.size !== quotas.length
                    || !quotas.every(quota => given.has(quota.id))) {
                    throw new ServiceError('BAD PARAMETERS', 'Rekkefølgen må nevne hver kvote i arrangementet én gang.')
                }

                await Promise.all(data.quotaIds.map((quotaId, order) => tx.eventRegistrationQuota.update({
                    where: { id: quotaId },
                    data: { order },
                })))
            })
        },
    }),
} as const
