import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerMovementOperations } from '@/services/ledger/movements/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { UserFiltered } from '@/services/users/types'

const HOUR = 60 * 60 * 1000
// eventOperations.create's price field is in kroner (it runs through convertAmount); everything
// else here (ledger funds, amountFromBalance) is in øre, so the two are kept separate.
const EVENT_PRICE_KRONER = 50
const EVENT_PRICE_ORE = EVENT_PRICE_KRONER * 100
const STARTING_BALANCE = 100_00

let currentOrder: number
let membersGroupId: number
let committeeId: number
let committeeAccountId: number

async function createManualGroup(shortName: string) {
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: shortName, shortName } },
        },
    })
    return group.id
}

async function createCommittee(shortName: string) {
    const committee = await prisma.committee.create({
        data: {
            name: shortName,
            shortName,
            group: { create: { groupType: 'COMMITTEE', order: currentOrder } },
            committeeArticle: { create: { name: shortName, coverImage: { create: {} } } },
            paragraph: { create: {} },
        },
    })
    const account = await ledgerAccountOperations.create({
        data: { name: shortName, groupIds: [committee.groupId] },
        bypassAuth: true,
    })
    return { committeeId: committee.id, accountId: account.id }
}

function sessionOf(user: UserFiltered, groupIds: number[] = [membersGroupId]) {
    const memberships: MembershipFiltered[] = groupIds.map(groupId => ({
        groupId,
        order: currentOrder,
        active: true,
        admin: false,
    }))
    return Session.fromJsObject({ user, permissions: [], memberships })
}

// createPayment needs LEDGER_USE on top of registering (see ledgerTransactionAuth.create):
// production is expected to grant it by default, which test sessions must do explicitly.
const payerSessionOf = (user: UserFiltered) => Session.fromJsObject({
    user,
    permissions: ['LEDGER_USE'],
    memberships: sessionOf(user).memberships,
})

async function createPaidEvent({ ledgerAccountId }: { ledgerAccountId?: number } = {}) {
    const now = new Date()
    const event = await eventOperations.create({
        data: {
            name: 'Betalt testarrangement',
            location: 'Lophtet',
            eventStart: new Date(now.getTime() + 7 * 24 * HOUR),
            eventEnd: new Date(now.getTime() + 7 * 24 * HOUR + 2 * HOUR),
            canBeViewedBy: 'ALL',
            takesRegistration: true,
            places: 10,
            waitingList: false,
            registrationStart: new Date(now.getTime() - HOUR),
            registrationEnd: new Date(now.getTime() + 24 * HOUR),
            takesPayment: true,
            price: EVENT_PRICE_KRONER,
            paymentStart: new Date(now.getTime() - HOUR),
            paymentEnd: new Date(now.getTime() + 24 * HOUR),
            hostedByCommitteeId: committeeId,
            tagIds: [],
            quotaVisibilityRequirements: [
                { conditions: [{ type: 'ACTIVE', groupId: membersGroupId }] },
            ],
            visibilityAdminRequirements: [
                { conditions: [{ type: 'ACTIVE', groupId: membersGroupId }] },
            ],
        },
        bypassAuth: true,
    })
    await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    if (ledgerAccountId) {
        await eventOperations.connectToLedgerAccount({
            params: { id: event.id },
            data: { ledgerAccountId },
            bypassAuth: true,
        })
    }
    return event.id
}

async function createPayer(username: string) {
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
    await ledgerMovementOperations.createDeposit({
        params: { ledgerAccountId: account.id, provider: 'MANUAL', funds: STARTING_BALANCE, manualFees: 0 },
        bypassAuth: true,
    })
    return user
}

const balanceOf = async (ledgerAccountId: number) => (await ledgerAccountOperations.calculateBalance({
    params: { ledgerAccountId },
    bypassAuth: true,
})).amount

beforeAll(async () => {
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    membersGroupId = await createManualGroup('registration-payment-members')
    const committee = await createCommittee('registration-payment-committee')
    committeeId = committee.committeeId
    committeeAccountId = committee.accountId
})

describe('paying for an event', () => {
    test('an event linked to no account refuses payment', async () => {
        const payer = await createPayer('eventpaynoaccount')
        const eventId = await createPaidEvent()
        await eventRegistrationOperations.create({
            params: { userId: payer.id, eventId },
            session: sessionOf(payer),
        })

        await expect(eventRegistrationOperations.createPayment({
            params: { userId: payer.id, eventId, amountFromBalance: EVENT_PRICE_ORE },
            session: payerSessionOf(payer),
        })).rejects.toThrow(new Smorekopp('SERVER ERROR'))
    })

    test('an event may only be linked to a group account', async () => {
        const payer = await createPayer('eventpayuseraccount')
        const eventId = await createPaidEvent()
        const userAccount = await ledgerAccountOperations.read({ params: { userId: payer.id }, bypassAuth: true })

        await expect(eventOperations.connectToLedgerAccount({
            params: { id: eventId },
            data: { ledgerAccountId: userAccount.id },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('an event credits the account it is linked to on payment', async () => {
        const payer = await createPayer('eventpaywithaccount')
        const eventId = await createPaidEvent({ ledgerAccountId: committeeAccountId })
        await eventRegistrationOperations.create({
            params: { userId: payer.id, eventId },
            session: sessionOf(payer),
        })

        const committeeBalanceBefore = await balanceOf(committeeAccountId)

        const { payment } = await eventRegistrationOperations.createPayment({
            params: { userId: payer.id, eventId, amountFromBalance: EVENT_PRICE_ORE },
            session: payerSessionOf(payer),
        })

        expect(payment).toBeNull()
        expect(await balanceOf(committeeAccountId)).toBe(committeeBalanceBefore + EVENT_PRICE_ORE)
    })
})
