import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { defineOperation, isPrismaClient } from '@/services/serviceOperation'
import { Smorekopp, ServiceError } from '@/services/error'
import { prisma as globalPrisma } from '@/prisma-pn-client-instance'
import { describe, expect, jest, test } from '@jest/globals'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { z } from 'zod'
import type { PrismaClient } from '@/prisma-generated-pn-client'

describe('service operation', () => {
    describe('simple', () => {
        const addPositiveOnly = defineOperation({
            authorizer: ({ data: { a, b } }) => {
                if (a < 0 || b < 0) {
                    // The bare `Require` entry point has no rules chained onto it, so it always denies.
                    return Require
                }

                return Require.nothing()
            },
            dataSchema: z.object({
                a: z.number(),
                b: z.number(),
            }),
            operation: ({ data: { a, b } }) => a + b,
        })

        test('method result', async () => {
            const res = await addPositiveOnly({
                data: {
                    a: 1,
                    b: 2,
                },
            })

            expect(res).toBe(3)
        })

        test('auth fail', async () => {
            await expect(addPositiveOnly({
                data: {
                    a: -1,
                    b: 2,
                },
            })).rejects.toThrow()
        })

        test('bypass auth', async () => {
            const res = await addPositiveOnly({
                data: {
                    a: -1,
                    b: 2,
                },
                bypassAuth: true,
            })

            expect(res).toBe(1)
        })
    })

    describe('nested', () => {
        // Simple service operation that just returns its own context
        const inner = defineOperation({
            authorizer: () => Require.nothing(),
            operation: (context) => context,
        })

        // Outer service operation that calls the inner one and returns its context
        const outer = defineOperation({
            authorizer: () => Require.nothing(),
            operation: async () => await inner({}),
        })

        test('nested context global defaults', async () => {
            const res = await outer({})

            expect(res.bypassAuth).toBe(false)
            expect(res.session).toBeInstanceOf(Session)
            expect(res.prisma).toBe(globalPrisma)
        })

        test('nested context override bypassAuth', async () => {
            const res = await outer({ bypassAuth: true })

            expect(res.bypassAuth).toBe(true)
            expect(res.session).toBeInstanceOf(Session)
            expect(res.prisma).toBe(globalPrisma)
        })

        test('nested context override session', async () => {
            const customSession = Session.fromJsObject({
                apiKeyId: 1919,
                memberships: [],
                permissions: [],
                user: null,
            })

            const res = await outer({ session: customSession })

            expect(res.bypassAuth).toBe(false)
            expect(res.session).toBe(customSession)
            expect(res.prisma).toBe(globalPrisma)
        })

        test('nested context override prisma', async () => {
            await globalPrisma.$transaction(async (tx) => {
                const res = await outer({ prisma: tx })

                expect(res.bypassAuth).toBe(false)
                expect(res.session).toBeInstanceOf(Session)
                expect(res.prisma).toBe(tx)
            })
        })
    })

    describe('transactions', () => {
        const rollback = new Error('rollback')
        let lastWrittenId = 0

        // Writes a row, and says whether it got a transaction client. Fails after the write when asked.
        const writeInTransaction = defineOperation({
            authorizer: () => Require.nothing(),
            dataSchema: z.object({ fail: z.boolean() }),
            transaction: 'RUNS_IN',
            operation: async ({ prisma, data }) => {
                const methods = await prisma.notificationMethod.create({ data: {} })
                lastWrittenId = methods.id
                if (data.fail) throw new ServiceError('BAD DATA', 'Asked to fail')
                return { id: methods.id, inTransaction: !isPrismaClient(prisma) }
            },
        })

        const opensTransaction = defineOperation({
            authorizer: () => Require.nothing(),
            transaction: 'OPENS',
            operation: ({ prisma }) => prisma.$transaction(tx => tx.notificationMethod.count()),
        })

        const exists = async (id: number) => (await globalPrisma.notificationMethod.findUnique({ where: { id } })) !== null

        test('RUNS_IN opens a transaction for a caller outside one, which a failure rolls back', async () => {
            const written = await writeInTransaction({ data: { fail: false } })
            expect(written.inTransaction).toBe(true)
            expect(await exists(written.id)).toBe(true)

            await expect(writeInTransaction({ data: { fail: true } })).rejects.toThrow(ServiceError)
            expect(lastWrittenId).not.toBe(written.id)
            expect(await exists(lastWrittenId)).toBe(false)

            await globalPrisma.notificationMethod.delete({ where: { id: written.id } })
        })

        test('RUNS_IN joins the transaction of a caller in one, also when called at once', async () => {
            const written = await globalPrisma.$transaction(async tx => {
                const results = await Promise.all([
                    writeInTransaction({ data: { fail: false }, prisma: tx }),
                    writeInTransaction({ data: { fail: false }, prisma: tx }),
                ])
                expect(results.every(result => result.inTransaction)).toBe(true)
                const ids = results.map(result => result.id)
                expect(await tx.notificationMethod.count({ where: { id: { in: ids } } })).toBe(2)
                return results
            })
            expect(await exists(written[0].id)).toBe(true)

            await globalPrisma.$transaction(async tx => {
                await writeInTransaction({ data: { fail: false }, prisma: tx })
                throw rollback
            }).catch((error: unknown) => expect(error).toBe(rollback))

            await globalPrisma.notificationMethod.deleteMany({ where: { id: { in: written.map(result => result.id) } } })
        })

        test('RUNS_IN turns a failure of the transaction itself into a service error', async () => {
            const timeout = new PrismaClientKnownRequestError('Transaction timed out', {
                code: 'P2028',
                clientVersion: 'test',
            })
            const transaction = jest.spyOn(globalPrisma, '$transaction').mockRejectedValueOnce(timeout)

            await expect(writeInTransaction({ data: { fail: false } })).rejects.toMatchObject({
                errorCode: 'SERVER ERROR',
                errors: [{ message: 'Operasjonen tok for lang tid. Prøv igjen.' }],
            })

            transaction.mockRestore()
        })

        test('OPENS is refused inside a transaction', async () => {
            expect(await opensTransaction({})).toEqual(expect.any(Number))
            await globalPrisma.$transaction(async tx => {
                await expect(opensTransaction({ prisma: tx as unknown as PrismaClient })).rejects.toThrow(Smorekopp)
            })
        })
    })
})
