import '@pn-server-only'
import { careersTeamAuth } from './auth'
import { careersTeamSchemas } from './schemas'
import { careersTeamDepartmentIncluder } from './constants'
import { destroyPersonsAndReturnCleanup } from './persons/destroyPersons'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import type { ExpandedCareerTeamDepartment } from './types'

export const careersTeamOperations = {
    readDepartments: defineOperation({
        authorizer: () => careersTeamAuth.readDepartments,
        operation: ({ prisma }): Promise<ExpandedCareerTeamDepartment[]> => prisma.careerTeamDepartment.findMany({
            orderBy: { order: 'asc' },
            include: careersTeamDepartmentIncluder,
        }),
    }),

    createDepartment: defineOperation({
        dataSchema: careersTeamSchemas.data.createDepartment,
        authorizer: () => careersTeamAuth.createDepartment,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, data }) => {
            const paragraph = await cmsParagraphOperations.create.internalCall({
                data: {},
                prisma,
                operationImplementationFields: { special: null },
            })
            return prisma.careerTeamDepartment.create({
                data: { ...data, paragraphId: paragraph.id },
            })
        },
    }),

    updateDepartment: defineOperation({
        paramsSchema: careersTeamSchemas.params.updateDepartment,
        dataSchema: careersTeamSchemas.data.updateDepartment,
        authorizer: () => careersTeamAuth.updateDepartment,
        operation: async ({ prisma, params, data }) => {
            await prisma.careerTeamDepartment.update({
                where: { id: params.departmentId },
                data,
            })
        },
    }),

    moveDepartment: defineOperation({
        paramsSchema: careersTeamSchemas.params.moveDepartment,
        dataSchema: careersTeamSchemas.data.moveDepartment,
        authorizer: () => careersTeamAuth.moveDepartment,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params, data }) => {
            const department = await prisma.careerTeamDepartment.findUniqueOrThrow({
                where: { id: params.departmentId },
                select: { id: true, order: true },
            })
            const neighbour = await prisma.careerTeamDepartment.findFirst({
                where: { order: data.direction === 'UP' ? { lt: department.order } : { gt: department.order } },
                orderBy: { order: data.direction === 'UP' ? 'desc' : 'asc' },
                select: { id: true, order: true },
            })
            if (!neighbour) throw new ServiceError('BAD PARAMETERS', 'Avdelingen kan ikke flyttes dit')

            // Swapped by way of -1, since the order is unique.
            await prisma.careerTeamDepartment.update({ where: { id: department.id }, data: { order: -1 } })
            await prisma.careerTeamDepartment.update({ where: { id: neighbour.id }, data: { order: department.order } })
            await prisma.careerTeamDepartment.update({ where: { id: department.id }, data: { order: neighbour.order } })
        },
    }),

    destroyDepartment: defineOperation({
        paramsSchema: careersTeamSchemas.params.destroyDepartment,
        authorizer: () => careersTeamAuth.destroyDepartment,
        transaction: 'OPENS',
        operation: async ({ prisma, params }) => {
            const cleanup = await prisma.$transaction(async tx => {
                const personsCleanup = await destroyPersonsAndReturnCleanup(tx, { departmentId: params.departmentId })

                // The paragraph is on the department's side of the relation, so it does not cascade.
                const department = await tx.careerTeamDepartment.delete({
                    where: { id: params.departmentId },
                    select: { paragraphId: true },
                })
                await cmsParagraphOperations.destroy.internalCall({
                    params: { paragraphId: department.paragraphId },
                    prisma: tx,
                })
                return personsCleanup
            })
            await cleanup()
        },
    }),

    updateDepartmentParagraph: cmsParagraphOperations.updateContent.implement({
        authorizer: () => careersTeamAuth.updateDepartmentParagraph,
        ownershipCheck: async ({ params, prisma }) => (
            await prisma.careerTeamDepartment.findUnique({
                where: { paragraphId: params.paragraphId },
                select: { id: true },
            })
        ) !== null,
    }),
} as const
