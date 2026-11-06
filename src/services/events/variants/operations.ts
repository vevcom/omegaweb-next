import '@pn-server-only'
import { eventVariantAuth } from './auth'
import { eventVariantSchemas } from './schemas'
import { assertValidVariant, createVariant, unpaidVariant } from './createVariant'
import { assertSeenThroughQuotas, readEventAccess, readEventIdOfVariant } from '@/services/events/access'
import { eventQuotaOrder, eventVariantOrder, eventVariantSummarySelection } from '@/services/events/constants'
import { lockEvent, registrationsOfVariant } from '@/services/events/registration/queue'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { visibilityOperations } from '@/services/visibility/operations'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventVariantExpanded } from './types'

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

    create: defineOperation({
        paramsSchema: eventVariantSchemas.params.create,
        dataSchema: eventVariantSchemas.data.create,
        authorizer: async ({ params, prisma }) => eventVariantAuth.create.data(
            await readEventAccess(prisma, params.eventId)
        ),
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params, data }) =>
            await createVariant(prisma, params.eventId, data),
    }),

    update: defineOperation({
        paramsSchema: eventVariantSchemas.params.update,
        dataSchema: eventVariantSchemas.data.update,
        authorizer: async ({ params, prisma }) => eventVariantAuth.update.data(
            await readEventAccess(prisma, await readEventIdOfVariant(prisma, params.id))
        ),
        operation: async ({ prisma, params, data }) => {
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
    }),

    destroy: defineOperation({
        paramsSchema: eventVariantSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => eventVariantAuth.destroy.data(
            await readEventAccess(prisma, await readEventIdOfVariant(prisma, params.id))
        ),
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params }) => {
            const variant = await prisma.eventVariant.findUniqueOrThrow({
                where: { id: params.id },
                select: { eventId: true, quotas: { select: { visibilityId: true } } },
            })

            await lockEvent(prisma, variant.eventId)
            if (await prisma.eventRegistration.count({ where: registrationsOfVariant(params.id) }) > 0) {
                throw new ServiceError('BAD PARAMETERS', 'Varianten har påmeldte. Meld dem av før du fjerner den.')
            }
            await prisma.eventVariant.delete({ where: { id: params.id } })
            await Promise.all(variant.quotas.map(quota => visibilityOperations.destroy.internalCall({
                prisma,
                params: { visibilityId: quota.visibilityId },
            })))
            await assertSeenThroughQuotas(prisma, variant.eventId)
        },
    }),
} as const
