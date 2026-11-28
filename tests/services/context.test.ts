import { prisma as globalPrisma } from '@/prisma/client'
import { defineOperation, getContext, withServiceContext } from '@/services/serviceOperation'
import { Session } from '@/auth/session/Session'
import { Require } from '@/auth/authorizer/Require'
import { describe, test, expect, jest } from '@jest/globals'
import type { ServiceOperationContext } from '@/services/serviceOperation'

const returnContextInfo = defineOperation({
    authorizer: () => Require.nothing(),
    read: true,
    operation: ({ prisma, session }) => ({
        inTransaction: '$transaction' in prisma,
        apiKeyId: session.apiKeyId,
    })
})

const callReturnContextInfo = defineOperation({
    authorizer: () => Require.nothing(),
    read: true,
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

    const contexts: Omit<ServiceOperationContext, 'cache'>[] = [
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

    test('is one for the process, so the log of the one client knows who asks in either runtime', async () => {
        jest.resetModules()
        const copy = await import('@/services/serviceOperation')
        expect(copy.withServiceContext).not.toBe(withServiceContext)

        const seenByTheLog = copy.withServiceContext({ session: apiKeySession }, 'NONE', () => getContext()?.session)

        expect(seenByTheLog).toBe(apiKeySession)
    })
})
