import '@ow-server-only'
import { revueGroupArticleSection } from './articleSection'
import { revueGroupAuth } from './auth'
import { revueGroupExpandedIncluder } from './constants'
import { destroyRevueGroups } from './destroyGroups'
import { revueGroupSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import type { ExpandedRevueGroupMember, RevueGroupMemberWithUser } from './types'

export const revueGroupOperations = {
    create: defineOperation({
        paramsSchema: revueGroupSchemas.params.create,
        dataSchema: revueGroupSchemas.data.create,
        authorizer: () => revueGroupAuth.create,
        transaction: 'OPENS',
        operation: ({ prisma, params, data }) => prisma.$transaction(async tx => {
            const articleSection = await revueGroupArticleSection.internal.create.internalCall({ data: {}, prisma: tx })
            return tx.revueGroup.create({
                data: { ...data, revueId: params.revueId, articleSectionId: articleSection.id },
            })
        }),
    }),

    read: defineOperation({
        paramsSchema: revueGroupSchemas.params.read,
        authorizer: () => revueGroupAuth.read,
        operation: async ({ prisma, params }) => {
            const group = await prisma.revueGroup.findFirstOrThrow({
                where: { name: params.name, revue: { year: params.year } },
                include: revueGroupExpandedIncluder,
            })
            return {
                ...group,
                members: group.members
                    .map(embedMemberName)
                    .sort((first, second) => first.name.localeCompare(second.name, 'nb')),
            }
        },
    }),

    update: defineOperation({
        paramsSchema: revueGroupSchemas.params.update,
        dataSchema: revueGroupSchemas.data.update,
        authorizer: () => revueGroupAuth.update,
        operation: ({ prisma, params, data }) => prisma.revueGroup.update({
            where: { id: params.groupId },
            data,
        }),
    }),

    destroy: defineOperation({
        paramsSchema: revueGroupSchemas.params.destroy,
        authorizer: () => revueGroupAuth.destroy,
        transaction: 'OPENS',
        operation: ({ prisma, params }) => prisma.$transaction(tx => destroyRevueGroups(tx, { id: params.groupId })),
    }),

    articleSection: revueGroupArticleSection,
} as const

function embedMemberName(member: RevueGroupMemberWithUser): ExpandedRevueGroupMember {
    return {
        ...member,
        name: member.type === 'USER' && member.user
            ? `${member.user.firstname} ${member.user.lastname}`
            : member.name ?? '',
    }
}
