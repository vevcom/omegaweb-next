import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/prisma-pn-client-instance'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerMovementAuth } from '@/services/ledger/movements/auth'
import { ledgerMovementOperations } from '@/services/ledger/movements/operations'
import { STRIPE_MINIMUM_PAYMENT_AMOUNT } from '@/services/ledger/payments/constants'
import { userOperations } from '@/services/users/operations'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Permission } from '@/prisma-generated-pn-types'

const DEPOSIT = 100_00

type SessionUser = NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>

const sessionOf = (userId: number | null, permissions: Permission[], groupIds: number[] = []) => Session.fromJsObject({
    memberships: groupIds.map(groupId => ({ groupId, admin: false, active: true, order: 0 })),
    permissions,
    user: userId === null ? null : { id: userId } as SessionUser,
})

describe('ledgerMovementAuth.createDeposit', () => {
    const OWNER_ID = 1
    const GROUP_ID = 7
    const ownedAccount = { userId: OWNER_ID, groupIds: [] }
    const foreignAccount = { userId: OWNER_ID + 1, groupIds: [] }
    const groupAccount = { userId: null, groupIds: [GROUP_ID] }

    test('an owner may deposit to their own account', () => {
        const authorizer = ledgerMovementAuth.createDeposit.data({ accounts: [ownedAccount] })
        expect(authorizer.auth(sessionOf(OWNER_ID, ['LEDGER_USE'])).authorized).toBe(true)
        expect(authorizer.auth(sessionOf(OWNER_ID, [])).authorized).toBe(false)
    })

    test('a member may deposit to the account of their group', () => {
        const authorizer = ledgerMovementAuth.createDeposit.data({ accounts: [groupAccount] })
        expect(authorizer.auth(sessionOf(OWNER_ID, ['LEDGER_USE'], [GROUP_ID])).authorized).toBe(true)
        expect(authorizer.auth(sessionOf(OWNER_ID, ['LEDGER_USE'])).authorized).toBe(false)
    })

    test('the account of someone else takes LEDGER_ADMIN', () => {
        const authorizer = ledgerMovementAuth.createDeposit.data({ accounts: [foreignAccount] })
        expect(authorizer.auth(sessionOf(OWNER_ID, ['LEDGER_USE'])).authorized).toBe(false)
        expect(authorizer.auth(sessionOf(OWNER_ID, ['LEDGER_USE', 'LEDGER_ADMIN'])).authorized).toBe(true)
    })

    test('a visitor who is not logged in may not deposit, whatever their permissions', () => {
        const authorizer = ledgerMovementAuth.createDeposit.data({ accounts: [foreignAccount] })
        expect(authorizer.auth(sessionOf(null, ['LEDGER_USE'])).authorized).toBe(false)
        expect(authorizer.auth(sessionOf(null, ['LEDGER_USE', 'LEDGER_ADMIN'])).authorized).toBe(false)
    })
})

describe('creating deposits', () => {
    let createdIntents = 0
    let createIntent: ReturnType<typeof jest.spyOn>

    beforeEach(() => {
        createIntent = jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(() => {
            createdIntents++
            const id = `pi_test_deposit_${createdIntents}`
            return Promise.resolve({ id, client_secret: `${id}_secret` } as never)
        })
        jest.spyOn(stripe.customers, 'create').mockImplementation(() => Promise.resolve(
            { id: `cus_test_deposit_${createdIntents}` } as never
        ))
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    async function createUserWithAccount(username: string) {
        const user = await userOperations.create({
            data: {
                email: `${username}@omega.ntnu.no`,
                firstname: 'Test',
                lastname: 'Testesen',
                username,
                emailVerified: new Date().toISOString(),
            },
            bypassAuth: true,
        })
        const account = await ledgerAccountOperations.read({ params: { userId: user.id }, bypassAuth: true })
        return { userId: user.id, accountId: account.id }
    }

    const deposit = (ledgerAccountId: number, session: SessionMaybeUser, funds = DEPOSIT, description?: string) =>
        ledgerMovementOperations.createDeposit({
            implementationParams: { ledgerAccountId, funds },
            params: { provider: 'STRIPE', description },
            session,
        })

    test('a user may deposit to their own account, and it is sent to Stripe', async () => {
        const owner = await createUserWithAccount('depositowner')

        const { payment } = await deposit(owner.accountId, sessionOf(owner.userId, ['LEDGER_USE']))

        expect(payment).toMatchObject({ state: 'PROCESSING', funds: DEPOSIT })
        expect(createIntent).toHaveBeenCalledTimes(1)
    })

    test('a user may not deposit to the account of someone else', async () => {
        const owner = await createUserWithAccount('depositvictim')
        const other = await createUserWithAccount('depositstranger')
        const paymentsBefore = await prisma.payment.count()

        await expect(deposit(owner.accountId, sessionOf(other.userId, ['LEDGER_USE'])))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        expect(await prisma.payment.count()).toBe(paymentsBefore)
        expect(createIntent).not.toHaveBeenCalled()
    })

    test('a visitor who is not logged in may not deposit', async () => {
        const owner = await createUserWithAccount('depositvisited')

        await expect(deposit(owner.accountId, sessionOf(null, ['LEDGER_USE'])))
            .rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
        expect(createIntent).not.toHaveBeenCalled()
    })

    test('a STRIPE deposit below the minimum is refused, but a MANUAL one is not', async () => {
        const owner = await createUserWithAccount('depositsmall')

        await expect(deposit(owner.accountId, sessionOf(owner.userId, ['LEDGER_USE']), STRIPE_MINIMUM_PAYMENT_AMOUNT - 1))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(createIntent).not.toHaveBeenCalled()

        // The minimum is Stripe's own processing floor, not a general rule - a MANUAL deposit
        // (e.g. an admin recording cash received) has no such floor.
        const byHand = await ledgerMovementOperations.createDeposit({
            implementationParams: { ledgerAccountId: owner.accountId, funds: STRIPE_MINIMUM_PAYMENT_AMOUNT - 1 },
            params: { provider: 'MANUAL' },
            bypassAuth: true,
        })
        expect(byHand.transaction.state).toBe('SUCCEEDED')
    })

    test('LEDGER_ADMIN may deposit to any account, and only a MANUAL deposit keeps its description', async () => {
        const owner = await createUserWithAccount('depositdescribed')
        const admin = await createUserWithAccount('depositadmin')
        const adminSession = sessionOf(admin.userId, ['LEDGER_USE', 'LEDGER_ADMIN'])

        const byStripe = await deposit(owner.accountId, adminSession, DEPOSIT, 'Via Stripe')
        const byHand = await ledgerMovementOperations.createDeposit({
            implementationParams: { ledgerAccountId: owner.accountId, funds: DEPOSIT },
            params: { provider: 'MANUAL', description: 'Kontant' },
            session: adminSession,
        })

        expect(byStripe.transaction.description).toBeNull()
        expect(byHand.transaction.description).toBe('Kontant')
    })
})
