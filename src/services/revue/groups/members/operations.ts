import '@pn-server-only'
import { revueGroupMemberAuth } from './auth'
import { revueGroupMemberSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import type { z } from 'zod'

export const revueGroupMemberOperations = {
    create: defineOperation({
        paramsSchema: revueGroupMemberSchemas.params.create,
        dataSchema: revueGroupMemberSchemas.data.create,
        authorizer: () => revueGroupMemberAuth.create,
        operation: ({ prisma, params, data }) => prisma.revueGroupMember.create({
            data: { ...memberFields(data), groupId: params.groupId },
        }),
    }),

    update: defineOperation({
        paramsSchema: revueGroupMemberSchemas.params.update,
        dataSchema: revueGroupMemberSchemas.data.update,
        authorizer: () => revueGroupMemberAuth.update,
        operation: ({ prisma, params, data }) => prisma.revueGroupMember.update({
            where: { id: params.memberId },
            data: memberFields(data),
        }),
    }),

    destroy: defineOperation({
        paramsSchema: revueGroupMemberSchemas.params.destroy,
        authorizer: () => revueGroupMemberAuth.destroy,
        operation: async ({ prisma, params }) => {
            await prisma.revueGroupMember.delete({ where: { id: params.memberId } })
        },
    }),
} as const

function memberFields(data: z.output<typeof revueGroupMemberSchemas.data.create>) {
    return data.type === 'USER'
        ? { type: data.type, userId: data.userId, name: null }
        : { type: data.type, name: data.name, userId: null }
}
