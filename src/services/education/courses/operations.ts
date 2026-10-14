import '@pn-server-only'
import { courseAuth } from './auth'
import { courseSchemas } from './schemas'
import { courseIncluder } from './constants'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { defineOperation } from '@/services/serviceOperation'
import type { ExpandedCourse } from './types'

export const courseOperations = {
    /**
     * Creates a course at a school, with its own empty CMS paragraph for the description, in one
     * transaction.
     */
    create: defineOperation({
        authorizer: () => courseAuth.create,
        dataSchema: courseSchemas.data.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => prisma.$transaction(async tx => {
            const cmsParagraph = await cmsParagraphOperations.create.internalCall({
                data: {},
                prisma: tx,
                operationImplementationFields: { special: null },
            })

            return tx.course.create({
                data: {
                    name: data.name,
                    code: data.code,
                    ectsPoints: data.ectsPoints,
                    school: { connect: { id: data.schoolId } },
                    cmsParagraph: { connect: { id: cmsParagraph.id } },
                },
                include: courseIncluder,
            })
        }),
    }),

    read: defineOperation({
        authorizer: () => courseAuth.read,
        paramsSchema: courseSchemas.params.read,
        operation: async ({ prisma, params }) => prisma.course.findUniqueOrThrow({
            where: { id: params.id },
            include: {
                ...courseIncluder,
                cmsParagraph: true,
            },
        }),
    }),

    /** The courses of one school, or of every school when none is given, by course code. */
    readMany: defineOperation({
        authorizer: () => courseAuth.readMany,
        paramsSchema: courseSchemas.params.readMany,
        operation: async ({ prisma, params }): Promise<ExpandedCourse[]> => prisma.course.findMany({
            where: { schoolId: params.schoolId },
            include: courseIncluder,
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
        }),
    }),

    update: defineOperation({
        authorizer: () => courseAuth.update,
        paramsSchema: courseSchemas.params.update,
        dataSchema: courseSchemas.data.update,
        operation: async ({ prisma, params, data }) => prisma.course.update({
            where: { id: params.id },
            data,
            include: courseIncluder,
        }),
    }),

    /**
     * Destroys a course with its paragraph, and the links to it: which study programmes it belongs
     * to, and which courses it is approved as or has been used to approve.
     */
    destroy: defineOperation({
        authorizer: () => courseAuth.destroy,
        paramsSchema: courseSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async tx => {
            await tx.courseStudyProgram.deleteMany({ where: { courseId: params.id } })
            await tx.courseApprovedAs.deleteMany({
                where: { OR: [{ courseId: params.id }, { courseApprovedAsId: params.id }] },
            })
            const course = await tx.course.delete({ where: { id: params.id } })
            await cmsParagraphOperations.destroy.internalCall({
                params: { paragraphId: course.cmsParagraphId },
                prisma: tx,
            })
        }),
    }),
} as const
