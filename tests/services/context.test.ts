import { prisma as globalPrisma } from '@/prisma/client'
import { defineOperation } from '@/services/serviceOperation'
import { Session } from '@/auth/session/Session'
import { Require } from '@/auth/authorizer/Require'
import { describe, test, expect } from '@jest/globals'
import type { ServiceOperationContext } from '@/services/serviceOperation'

const returnContextInfo = defineOperation({
    authorizer: () => Require.nothing(),
    operation: async ({ prisma, session }) => ({
        inTransaction: '$transaction' in prisma,
        apiKeyId: session.apiKeyId,
    })
})

const callReturnContextInfo = defineOperation({
    authorizer: () => Require.nothing(),
    operation: async () => returnContextInfo({})
})

describe('context', () => {
    const apiKeySession = Session.fromJsObject({
        apiKeyId: 0,
        user: null,
        memberships: [],
        permissions: [],
    })
    const emptySession = Session.empty()

    const contexts: ServiceOperationContext[] = [
        { session: emptySession, prisma: globalPrisma, bypassAuth: false },
        { session: apiKeySession, prisma: globalPrisma, bypassAuth: false },
        { session: emptySession, prisma: globalPrisma, bypassAuth: true },
    ]

    test.each(contexts)('should work', async (context) => {
        const expected = {
            inTransaction: '$transaction' in context.prisma,
            apiKeyId: context.session?.apiKeyId,
        }

        for (const func of [returnContextInfo, callReturnContextInfo]) {
            const res = await func(context)
            expect(res).toMatchObject(expected)
        }
    })
})
