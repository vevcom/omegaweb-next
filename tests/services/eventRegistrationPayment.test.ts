import { recordSentMail } from 'tests/utils'
import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { requeueNextUnpaidRegistration } from '@/services/events/registration/requeueUnpaid'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerMovementOperations } from '@/services/ledger/movements/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { Prisma } from '@/prisma-generated-pn-types'
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
    if (ledgerAccountId) {
        await eventOperations.connectToLedgerAccount({
            params: { id: event.id },
            data: { ledgerAccountId },
            bypassAuth: true,
        })
    }
    // Directly, since the tests of an event without an account still need it published.
    await prisma.event.update({ where: { id: event.id }, data: { published: true } })
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
    // Seating reads memberships from the database, so the session alone is not enough.
    await prisma.membership.create({
        data: { userId: user.id, groupId: membersGroupId, admin: false, active: true, order: currentOrder },
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

    describe('after the payment period has ended', () => {
        async function createEventWithWaitingList(firstName: string, secondName: string) {
            const eventId = await createPaidEvent({ ledgerAccountId: committeeAccountId })
            await prisma.event.update({ where: { id: eventId }, data: { waitingList: true } })
            await prisma.eventQuota.updateMany({ where: { variant: { eventId } }, data: { places: 1 } })

            const seated = await createPayer(firstName)
            const waiting = await createPayer(secondName)
            const seatedRegistration = await eventRegistrationOperations.create({
                params: { userId: seated.id, eventId },
                session: sessionOf(seated),
            })
            const { id: waitingRegistrationId } = await eventRegistrationOperations.create({
                params: { userId: waiting.id, eventId },
                session: sessionOf(waiting),
            })
            await prisma.eventVariant.updateMany({
                where: { eventId },
                data: { paymentStart: new Date(Date.now() - 48 * HOUR), paymentEnd: new Date(Date.now() - HOUR) },
            })
            return { eventId, seated, seatedRegistration, waiting, waitingRegistrationId }
        }

        const pay = (payer: UserFiltered, eventId: number) => eventRegistrationOperations.createPayment({
            params: { userId: payer.id, eventId, amountFromBalance: EVENT_PRICE_ORE },
            session: payerSessionOf(payer),
        })
        const deadlineOf = async (payer: UserFiltered, eventId: number) => (await eventRegistrationOperations.readOfUser({
            params: { userId: payer.id, eventId },
            bypassAuth: true,
        }))?.paymentDeadline

        test('the one who kept their place cannot pay', async () => {
            const { eventId, seated } = await createEventWithWaitingList('eventpaykept', 'eventpaykeptwaiting')

            const { paymentEnd } = await prisma.eventVariant.findFirstOrThrow({ where: { eventId } })
            expect(await deadlineOf(seated, eventId)).toEqual(paymentEnd)
            await expect(pay(seated, eventId)).rejects.toThrow(Smorekopp)
        })

        test('someone promoted when a place is freed can pay', async () => {
            const { eventId, seatedRegistration, waiting } = await createEventWithWaitingList(
                'eventpayflushed',
                'eventpaypromoted',
            )

            await eventRegistrationOperations.destroyAsAdmin({
                params: { registrationId: seatedRegistration.id },
                bypassAuth: true,
            })
            expect((await deadlineOf(waiting, eventId))?.getTime()).toBeGreaterThan(Date.now() + 23 * HOUR)
            const { payment } = await pay(waiting, eventId)

            expect(payment).toBeNull()
        })

        test('someone promoted over 24 hours ago cannot pay', async () => {
            const { eventId, seatedRegistration, waiting, waitingRegistrationId } = await createEventWithWaitingList(
                'eventpayflushedearly',
                'eventpaypromotedearly',
            )

            await eventRegistrationOperations.destroyAsAdmin({
                params: { registrationId: seatedRegistration.id },
                bypassAuth: true,
            })
            await prisma.eventRegistration.update({
                where: { id: waitingRegistrationId },
                data: { promotedAt: new Date(Date.now() - 25 * HOUR) },
            })

            await expect(pay(waiting, eventId)).rejects.toThrow(Smorekopp)
        })
    })

    describe('requeueing unpaid registrations', () => {
        const requeueAllDue = async () => {
            while (await requeueNextUnpaidRegistration()) { /* until nothing is due */ }
        }

        const stateOf = async (registrationId: number) => (await prisma.eventRegistration.findUniqueOrThrow({
            where: { id: registrationId },
            select: { state: true },
        })).state

        const setCreatedLongAgo = (registrationId: number) => prisma.eventRegistration.update({
            where: { id: registrationId },
            data: { createdAt: new Date(Date.now() - 3 * HOUR) },
        })

        async function createExpiredEvent(name: string, { enabled = true }: { enabled?: boolean } = {}) {
            const eventId = await createPaidEvent({ ledgerAccountId: committeeAccountId })
            await prisma.event.update({ where: { id: eventId }, data: { waitingList: true } })
            await prisma.eventQuota.updateMany({ where: { variant: { eventId } }, data: { places: 1 } })

            const seated = await createPayer(`${name}seated`)
            const waiting = await createPayer(`${name}waiting`)
            const seatedRegistration = await eventRegistrationOperations.create({
                params: { userId: seated.id, eventId },
                session: sessionOf(seated),
            })
            const waitingRegistration = await eventRegistrationOperations.create({
                params: { userId: waiting.id, eventId },
                session: sessionOf(waiting),
            })
            await setCreatedLongAgo(seatedRegistration.id)
            await prisma.eventVariant.updateMany({
                where: { eventId },
                data: {
                    paymentStart: new Date(Date.now() - 48 * HOUR),
                    paymentEnd: new Date(Date.now() - HOUR),
                    requeueUnpaidRegistrations: enabled,
                },
            })
            return { eventId, seated, waiting, seatedRegistration, waitingRegistration }
        }

        test('leaves everyone alone when the variant has not asked for it', async () => {
            const { seatedRegistration } = await createExpiredEvent('requeueoff', { enabled: false })

            await requeueAllDue()

            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')
        })

        test('swaps the unpaid with the next in line, who then gets 24 hours', async () => {
            const sentMail = recordSentMail()
            const { seatedRegistration, waitingRegistration } = await createExpiredEvent('requeueon')

            await requeueAllDue()

            expect(await stateOf(seatedRegistration.id)).toBe('WAITING_LIST')
            expect(await stateOf(waitingRegistration.id)).toBe('IN_QUOTA')
            expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'requeueonseated@omega.ntnu.no' }))

            await prisma.eventRegistration.update({
                where: { id: waitingRegistration.id },
                data: { promotedAt: new Date(Date.now() - 25 * HOUR) },
            })
            await requeueAllDue()

            expect(await stateOf(waitingRegistration.id)).toBe('WAITING_LIST')
            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')
        })

        test('gives someone promoted before payment opened 24 hours from the opening', async () => {
            const { eventId, seatedRegistration } = await createExpiredEvent('requeueearlypromotion')
            await prisma.eventRegistration.update({
                where: { id: seatedRegistration.id },
                data: { promotedAt: new Date(Date.now() - 25 * HOUR) },
            })
            await prisma.eventVariant.updateMany({
                where: { eventId },
                data: { paymentStart: new Date(Date.now() - 2 * HOUR) },
            })

            await requeueAllDue()

            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')
        })

        test('goes behind everyone already waiting', async () => {
            const { eventId, seatedRegistration, waitingRegistration } = await createExpiredEvent('requeueback')
            const lastRegistration = await prisma.eventRegistration.create({
                data: {
                    state: 'WAITING_LIST',
                    userId: (await createPayer('requeuebacklast')).id,
                    waitingListVariantId: (await prisma.eventVariant.findFirstOrThrow({ where: { eventId } })).id,
                },
            })

            await requeueAllDue()

            const queue = await prisma.eventRegistration.findMany({
                where: { id: { in: [seatedRegistration.id, lastRegistration.id] } },
                orderBy: { queuedAt: 'asc' },
                select: { id: true },
            })
            expect(await stateOf(waitingRegistration.id)).toBe('IN_QUOTA')
            expect(queue.map(registration => registration.id)).toEqual([lastRegistration.id, seatedRegistration.id])
        })

        test('leaves them seated when no one is waiting', async () => {
            const { seatedRegistration, waitingRegistration } = await createExpiredEvent('requeuealone')
            const sentMail = recordSentMail()
            await prisma.eventRegistration.delete({ where: { id: waitingRegistration.id } })

            await requeueAllDue()

            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')
            expect(sentMail).not.toHaveBeenCalled()
        })

        test('leaves them seated when no one waiting may take the place', async () => {
            const { waiting, seatedRegistration, waitingRegistration } = await createExpiredEvent('requeuebarred')
            const sentMail = recordSentMail()
            await prisma.membership.deleteMany({ where: { userId: waiting.id } })

            await requeueAllDue()

            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')
            expect(await stateOf(waitingRegistration.id)).toBe('WAITING_LIST')
            expect(sentMail).not.toHaveBeenCalled()
        })

        test('keeps those who paid, and those paying right now', async () => {
            const { eventId, seated, seatedRegistration } = await createExpiredEvent('requeuepaid')
            await prisma.eventVariant.updateMany({
                where: { eventId },
                data: { paymentEnd: new Date(Date.now() + HOUR) },
            })
            await eventRegistrationOperations.createPayment({
                params: { userId: seated.id, eventId, amountFromBalance: EVENT_PRICE_ORE },
                session: payerSessionOf(seated),
            })
            await prisma.eventVariant.updateMany({
                where: { eventId },
                data: { paymentEnd: new Date(Date.now() - HOUR) },
            })

            await requeueAllDue()
            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')

            await prisma.ledgerTransaction.updateMany({
                where: { eventRegistrationId: seatedRegistration.id },
                data: { state: 'PENDING' },
            })
            await requeueAllDue()
            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')
            await prisma.ledgerTransaction.updateMany({
                where: { eventRegistrationId: seatedRegistration.id },
                data: { state: 'SUCCEEDED' },
            })
        })

        test('keeps those marked paid, guests and those who joined after the period', async () => {
            const { seatedRegistration, waitingRegistration } = await createExpiredEvent('requeuekept')
            const { quotaId } = await prisma.eventRegistration.findUniqueOrThrow({
                where: { id: seatedRegistration.id },
                select: { quotaId: true },
            })
            await prisma.eventRegistration.update({
                where: { id: seatedRegistration.id },
                data: { manuallyPaid: true },
            })
            await requeueAllDue()
            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')

            const contact = await prisma.contactDetails.create({
                data: { name: 'Gjest', email: 'requeuekeptguest@example.com' },
            })
            const guest = await prisma.eventRegistration.create({
                data: {
                    state: 'IN_QUOTA',
                    quotaId,
                    createdAt: new Date(Date.now() - 3 * HOUR),
                    contactId: contact.id,
                },
            })
            await requeueAllDue()
            expect(await stateOf(guest.id)).toBe('IN_QUOTA')

            const lateJoiner = await prisma.eventRegistration.create({
                data: { state: 'IN_QUOTA', quotaId, userId: (await createPayer('requeuekeptlate')).id },
            })
            await requeueAllDue()
            expect(await stateOf(lateJoiner.id)).toBe('IN_QUOTA')
            expect(await stateOf(waitingRegistration.id)).toBe('WAITING_LIST')
        })

        test('leaves the places alone once the event has started', async () => {
            const { eventId, seatedRegistration } = await createExpiredEvent('requeuestarted')
            await prisma.event.update({ where: { id: eventId }, data: { eventStart: new Date(Date.now() - HOUR) } })

            await requeueAllDue()

            expect(await stateOf(seatedRegistration.id)).toBe('IN_QUOTA')
        })
    })

    describe('while a payment or an unregistration waits for the other', () => {
        /** Holds the row lock createPayment takes, so what is started meanwhile waits for `change`. */
        async function whileLocked(
            registrationId: number,
            start: () => Promise<unknown>,
            change: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) {
            let started: Promise<unknown> = Promise.resolve()
            await prisma.$transaction(async tx => {
                await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${registrationId} FOR UPDATE`
                started = start()
                // Its failure is the caller's to expect.
                started.catch(() => undefined)
                await new Promise(resolve => setTimeout(resolve, 300))
                await change(tx)
            })
            return started
        }

        async function createRegistered(username: string) {
            const payer = await createPayer(username)
            const eventId = await createPaidEvent({ ledgerAccountId: committeeAccountId })
            const registration = await eventRegistrationOperations.create({
                params: { userId: payer.id, eventId },
                session: sessionOf(payer),
            })
            return { payer, eventId, registration }
        }

        test('unregistering refunds a payment that came in while it waited', async () => {
            const { payer, eventId, registration } = await createRegistered('eventpayraceunregister')
            const account = await ledgerAccountOperations.read({ params: { userId: payer.id }, bypassAuth: true })
            await eventRegistrationOperations.createPayment({
                params: { userId: payer.id, eventId, amountFromBalance: EVENT_PRICE_ORE },
                session: payerSessionOf(payer),
            })
            const where = { eventRegistrationId: registration.id }
            const { id: transactionId } = await prisma.ledgerTransaction.findFirstOrThrow({ where })
            await prisma.ledgerTransaction.update({ where: { id: transactionId }, data: { eventRegistrationId: null } })

            await whileLocked(
                registration.id,
                () => eventRegistrationOperations.destroyAsAdmin({
                    params: { registrationId: registration.id },
                    bypassAuth: true,
                }),
                tx => tx.ledgerTransaction.update({ where: { id: transactionId }, data: where }),
            )

            expect(await balanceOf(account.id)).toBe(STARTING_BALANCE)
        })

        test('a payment is refused when the place was lost while it waited', async () => {
            const { payer, eventId, registration } = await createRegistered('eventpayracepay')
            const { id: variantId } = await prisma.eventVariant.findFirstOrThrow({ where: { eventId } })

            await expect(whileLocked(
                registration.id,
                () => eventRegistrationOperations.createPayment({
                    params: { userId: payer.id, eventId, amountFromBalance: EVENT_PRICE_ORE },
                    session: payerSessionOf(payer),
                }),
                tx => tx.eventRegistration.update({
                    where: { id: registration.id },
                    data: { state: 'WAITING_LIST', quotaId: null, waitingListVariantId: variantId },
                }),
            )).rejects.toThrow(Smorekopp)

            expect(await prisma.ledgerTransaction.count({ where: { eventRegistrationId: registration.id } })).toBe(0)
        })
    })
})
