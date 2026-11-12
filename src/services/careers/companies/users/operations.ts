import '@pn-server-only'
import { companyUserAuth } from './auth'
import { companyUserOrdering, companyUserSelection, companyUserWithCompanySelection } from './constants'
import { companyUserSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { CompanyUserFiltered, CompanyUserWithCompany } from './types'

/** A company user's email is what they sign in with, so two cannot share one. */
async function refusingTakenEmail<Result>(write: () => Promise<Result>): Promise<Result> {
    try {
        return await write()
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ServiceError('DUPLICATE', 'E-postadressen tilhører allerede en bedriftsbruker.')
        }
        throw error
    }
}

export const companyUserOperations = {
    readOfCompany: defineOperation({
        paramsSchema: companyUserSchemas.params.readOfCompany,
        authorizer: () => companyUserAuth.readOfCompany,
        operation: ({ prisma, params }): Promise<CompanyUserFiltered[]> => prisma.companyUser.findMany({
            where: { companyId: params.companyId },
            orderBy: companyUserOrdering,
            select: companyUserSelection,
        }),
    }),

    read: defineOperation({
        paramsSchema: companyUserSchemas.params.read,
        authorizer: () => companyUserAuth.read,
        operation: ({ prisma, params }): Promise<CompanyUserWithCompany> => prisma.companyUser.findUniqueOrThrow({
            where: { id: params.id },
            select: companyUserWithCompanySelection,
        }),
    }),

    /**
     * Registers a person as a user of the company. The company user has no password yet, so
     * they cannot sign in before they have been sent a link to choose one.
     */
    create: defineOperation({
        paramsSchema: companyUserSchemas.params.create,
        dataSchema: companyUserSchemas.data.create,
        authorizer: () => companyUserAuth.create,
        operation: ({ prisma, params, data }): Promise<CompanyUserFiltered> => refusingTakenEmail(
            () => prisma.companyUser.create({
                data: { ...data, companyId: params.companyId },
                select: companyUserSelection,
            })
        ),
    }),

    update: defineOperation({
        paramsSchema: companyUserSchemas.params.update,
        dataSchema: companyUserSchemas.data.update,
        authorizer: () => companyUserAuth.update,
        operation: ({ prisma, params, data }): Promise<CompanyUserFiltered> => prisma.companyUser.update({
            where: { id: params.id },
            data,
            select: companyUserSelection,
        }),
    }),

    /** Whether the company user is an admin of the company, and whether they may act for it at all. */
    updateRole: defineOperation({
        paramsSchema: companyUserSchemas.params.updateRole,
        dataSchema: companyUserSchemas.data.updateRole,
        authorizer: () => companyUserAuth.updateRole,
        operation: ({ prisma, params, data }): Promise<CompanyUserFiltered> => prisma.companyUser.update({
            where: { id: params.id },
            // The role is carried by the session, so a change ends the sessions that carry the old one.
            data: { ...data, sessionEpoch: { increment: 1 } },
            select: companyUserSelection,
        }),
    }),

    destroy: defineOperation({
        paramsSchema: companyUserSchemas.params.destroy,
        authorizer: () => companyUserAuth.destroy,
        operation: async ({ prisma, params }) => {
            await prisma.companyUser.delete({ where: { id: params.id } })
        },
    }),
} as const
