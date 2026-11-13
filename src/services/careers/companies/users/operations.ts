import '@pn-server-only'
import { companyUserAuth } from './auth'
import { companyUserOrdering, companyUserSelection, companyUserWithCompanySelection } from './constants'
import { companyUserSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { sendCompanyUserPasswordMail } from '@/lib/email/systemMail/companyUserPassword'
import logger from '@/lib/logger'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
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

/** What the rules on a company user need of them: the user and the company they belong to. */
async function ownershipOf(prisma: PrismaPossibleTransaction<false>, companyUserId: number) {
    const { companyId } = await prisma.companyUser.findUniqueOrThrow({
        where: { id: companyUserId },
        select: { companyId: true },
    })
    return { companyId, companyUserId }
}

export const companyUserOperations = {
    readOfCompany: defineOperation({
        paramsSchema: companyUserSchemas.params.readOfCompany,
        authorizer: ({ params }) => companyUserAuth.readOfCompany.data({ companyId: params.companyId }),
        operation: ({ prisma, params }): Promise<CompanyUserFiltered[]> => prisma.companyUser.findMany({
            where: { companyId: params.companyId },
            orderBy: companyUserOrdering,
            select: companyUserSelection,
        }),
    }),

    read: defineOperation({
        paramsSchema: companyUserSchemas.params.read,
        authorizer: async ({ prisma, params }) => companyUserAuth.read.data(await ownershipOf(prisma, params.id)),
        operation: ({ prisma, params }): Promise<CompanyUserWithCompany> => prisma.companyUser.findUniqueOrThrow({
            where: { id: params.id },
            select: companyUserWithCompanySelection,
        }),
    }),

    /**
     * Registers a person as a user of the company. The company user has no password yet, so they
     * are mailed the link to choose one by, which is how they sign in the first time.
     */
    create: defineOperation({
        paramsSchema: companyUserSchemas.params.create,
        dataSchema: companyUserSchemas.data.create,
        authorizer: ({ params }) => companyUserAuth.create.data({ companyId: params.companyId }),
        operation: async ({ prisma, params, data }): Promise<CompanyUserFiltered> => {
            const { company, ...companyUser } = await refusingTakenEmail(
                () => prisma.companyUser.create({
                    data: { ...data, companyId: params.companyId },
                    select: { ...companyUserSelection, company: { select: { name: true } } },
                })
            )

            // Not awaited: the company user exists either way, and the link can be sent again from their page.
            void sendCompanyUserPasswordMail({ ...companyUser, company }).catch((error: unknown) => {
                logger.error(`Failed to send the password link to the new company user ${companyUser.id}`, { error })
            })

            return companyUser
        },
    }),

    update: defineOperation({
        paramsSchema: companyUserSchemas.params.update,
        dataSchema: companyUserSchemas.data.update,
        authorizer: async ({ prisma, params }) => companyUserAuth.update.data(await ownershipOf(prisma, params.id)),
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
        authorizer: async ({ prisma, params }) => companyUserAuth.updateRole.data(await ownershipOf(prisma, params.id)),
        operation: ({ prisma, params, data }): Promise<CompanyUserFiltered> => prisma.companyUser.update({
            where: { id: params.id },
            // The role is carried by the session, so a change ends the sessions that carry the old one.
            data: { ...data, sessionEpoch: { increment: 1 } },
            select: companyUserSelection,
        }),
    }),

    destroy: defineOperation({
        paramsSchema: companyUserSchemas.params.destroy,
        authorizer: async ({ prisma, params }) => companyUserAuth.destroy.data(await ownershipOf(prisma, params.id)),
        operation: async ({ prisma, params }) => {
            await prisma.companyUser.delete({ where: { id: params.id } })
        },
    }),
} as const
