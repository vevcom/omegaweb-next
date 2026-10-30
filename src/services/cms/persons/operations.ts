import '@pn-server-only'
import { cmsPersonSchemas } from './schemas'
import { cmsPersonIncluder } from './constants'
import { cmsImageOperations } from '@/cms/images/operations'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { CmsPersonOwner } from './types'

export const cmsPersonOperations = {
    create: defineSubOperation({
        dataSchema: () => cmsPersonSchemas.data.create,
        opensTransaction: true,
        operation: ({ owner }: { owner: CmsPersonOwner }) => ({ prisma, data }) =>
            prisma.$transaction(async tx => {
                const cmsImage = await cmsImageOperations.create.internalCall({
                    data: {},
                    prisma: tx,
                    operationImplementationFields: { special: null },
                })
                return tx.cmsPerson.create({
                    data: {
                        ...data,
                        ...owner,
                        cmsImageId: cmsImage.id,
                    },
                    include: cmsPersonIncluder,
                })
            }),
    }),

    update: defineSubOperation({
        paramsSchema: () => cmsPersonSchemas.params.update,
        dataSchema: () => cmsPersonSchemas.data.update,
        operation: () => ({ prisma, params, data }) => prisma.cmsPerson.update({
            where: { id: params.cmsPersonId },
            data,
            include: cmsPersonIncluder,
        }),
    }),

    destroy: defineSubOperation({
        paramsSchema: () => cmsPersonSchemas.params.destroy,
        opensTransaction: true,
        operation: () => ({ prisma, params }) => prisma.$transaction(async tx => {
            // The portrait is on the person's side of the relation, so it does not cascade.
            const person = await tx.cmsPerson.delete({
                where: { id: params.cmsPersonId },
                select: { cmsImageId: true },
            })
            await cmsImageOperations.destroy.internalCall({ params: { cmsImageId: person.cmsImageId }, prisma: tx })
        }),
    }),

    /**
     * Swaps a person with its nearest neighbour above or below it among the persons of the same owner.
     */
    move: defineSubOperation({
        paramsSchema: () => cmsPersonSchemas.params.move,
        dataSchema: () => cmsPersonSchemas.data.move,
        opensTransaction: true,
        operation: () => ({ prisma, params, data }) => prisma.$transaction(async tx => {
            const person = await tx.cmsPerson.findUnique({
                where: { id: params.cmsPersonId },
                select: { id: true, order: true, careerTeamDepartmentId: true },
            })
            if (!person) throw new ServiceError('NOT FOUND', 'Fant ikke personen')

            const neighbour = await tx.cmsPerson.findFirst({
                where: {
                    careerTeamDepartmentId: person.careerTeamDepartmentId,
                    order: data.direction === 'UP' ? { lt: person.order } : { gt: person.order },
                },
                orderBy: { order: data.direction === 'UP' ? 'desc' : 'asc' },
                select: { id: true, order: true },
            })
            if (!neighbour) throw new ServiceError('BAD PARAMETERS', 'Personen kan ikke flyttes dit')

            // Swapped by way of -1, since the order is unique within the owner.
            await tx.cmsPerson.update({ where: { id: person.id }, data: { order: -1 } })
            await tx.cmsPerson.update({ where: { id: neighbour.id }, data: { order: person.order } })
            await tx.cmsPerson.update({ where: { id: person.id }, data: { order: neighbour.order } })
        }),
    }),
} as const
