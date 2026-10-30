import '@pn-server-only'
import { careersTeamAuth } from './auth'
import { careersTeamSchemas } from './schemas'
import { careersTeamDepartmentIncluder } from './constants'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsPersonOperations } from '@/cms/persons/operations'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { ExpandedCareerTeamDepartment } from './types'

async function isTeamPerson(prisma: PrismaPossibleTransaction<boolean>, cmsPersonId: number) {
    const person = await prisma.cmsPerson.findUniqueOrThrow({
        where: { id: cmsPersonId },
        select: { careerTeamDepartmentId: true },
    })
    return person.careerTeamDepartmentId !== null
}

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
        opensTransaction: true,
        operation: ({ prisma, data }) => prisma.$transaction(async tx => {
            const paragraph = await cmsParagraphOperations.create.internalCall({
                data: {},
                prisma: tx,
                operationImplementationFields: { special: null },
            })
            return tx.careerTeamDepartment.create({
                data: { ...data, paragraphId: paragraph.id },
            })
        }),
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
        opensTransaction: true,
        operation: ({ prisma, params, data }) => prisma.$transaction(async tx => {
            const department = await tx.careerTeamDepartment.findUniqueOrThrow({
                where: { id: params.departmentId },
                select: { id: true, order: true },
            })
            const neighbour = await tx.careerTeamDepartment.findFirst({
                where: { order: data.direction === 'UP' ? { lt: department.order } : { gt: department.order } },
                orderBy: { order: data.direction === 'UP' ? 'desc' : 'asc' },
                select: { id: true, order: true },
            })
            if (!neighbour) throw new ServiceError('BAD PARAMETERS', 'Avdelingen kan ikke flyttes dit')

            // Swapped by way of -1, since the order is unique.
            await tx.careerTeamDepartment.update({ where: { id: department.id }, data: { order: -1 } })
            await tx.careerTeamDepartment.update({ where: { id: neighbour.id }, data: { order: department.order } })
            await tx.careerTeamDepartment.update({ where: { id: department.id }, data: { order: neighbour.order } })
        }),
    }),

    destroyDepartment: defineOperation({
        paramsSchema: careersTeamSchemas.params.destroyDepartment,
        authorizer: () => careersTeamAuth.destroyDepartment,
        opensTransaction: true,
        operation: ({ prisma, params }) => prisma.$transaction(async tx => {
            const persons = await tx.cmsPerson.findMany({
                where: { careerTeamDepartmentId: params.departmentId },
                select: { cmsImageId: true },
            })
            await tx.cmsPerson.deleteMany({ where: { careerTeamDepartmentId: params.departmentId } })
            for (const person of persons) {
                await cmsImageOperations.destroy.internalCall({ params: { cmsImageId: person.cmsImageId }, prisma: tx })
            }

            // The paragraph is on the department's side of the relation, so it does not cascade.
            const department = await tx.careerTeamDepartment.delete({
                where: { id: params.departmentId },
                select: { paragraphId: true },
            })
            await cmsParagraphOperations.destroy.internalCall({
                params: { paragraphId: department.paragraphId },
                prisma: tx,
            })
        }),
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

    createPerson: cmsPersonOperations.create.implement({
        implementationParamsSchema: careersTeamSchemas.params.createPerson,
        authorizer: () => careersTeamAuth.createPerson,
        ownershipCheck: async ({ implementationParams, prisma }) => (
            await prisma.careerTeamDepartment.findUnique({
                where: { id: implementationParams.departmentId },
                select: { id: true },
            })
        ) !== null,
        operationImplementationFields: ({ implementationParams }) => ({
            owner: { careerTeamDepartmentId: implementationParams.departmentId },
        }),
    }),

    updatePerson: cmsPersonOperations.update.implement({
        authorizer: () => careersTeamAuth.updatePerson,
        ownershipCheck: ({ params, prisma }) => isTeamPerson(prisma, params.cmsPersonId),
    }),

    movePerson: cmsPersonOperations.move.implement({
        authorizer: () => careersTeamAuth.movePerson,
        ownershipCheck: ({ params, prisma }) => isTeamPerson(prisma, params.cmsPersonId),
    }),

    destroyPerson: cmsPersonOperations.destroy.implement({
        authorizer: () => careersTeamAuth.destroyPerson,
        ownershipCheck: ({ params, prisma }) => isTeamPerson(prisma, params.cmsPersonId),
    }),

    updatePersonCmsImage: cmsImageOperations.update.implement({
        authorizer: () => careersTeamAuth.updatePersonCmsImage,
        ownershipCheck: async ({ params, prisma }) => {
            const person = await prisma.cmsPerson.findUnique({
                where: { cmsImageId: params.cmsImageId },
                select: { careerTeamDepartmentId: true },
            })
            return person !== null && person.careerTeamDepartmentId !== null
        },
    }),
} as const
