import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { purchaseOperations } from '@/services/shop/purchase/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerMovementOperations } from '@/services/ledger/movements/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'

const STARTING_BALANCE = 100_00
const SODA_PRICE = 15_00
const CHOCOLATE_PRICE = 20_00

/** The session of the kiosk that charges the card. */
const kioskSession = Session.fromJsObject({ user: null, permissions: ['PURCHASE_ADMIN'], memberships: [] })

let shopId: number
let shopAccountId: number
let sodaId: number
let chocolateId: number
let notForSaleId: number
/** Its active members are allowed to shop. */
let shoppersGroupId: number

beforeAll(async () => {
    const shopAccount = await prisma.ledgerAccount.create({ data: { type: 'GROUP', name: 'Testbutikk' } })
    shopAccountId = shopAccount.id
    shopId = (await prisma.shop.create({ data: { name: 'Testbutikk', ledgerAccountId: shopAccount.id } })).id

    const createProduct = async (name: string, price: number, active = true) => {
        const product = await prisma.product.create({ data: { name } })
        await prisma.shopProduct.create({ data: { shopId, productId: product.id, price, active } })
        return product.id
    }
    sodaId = await createProduct('Testbrus', SODA_PRICE)
    chocolateId = await createProduct('Testsjokolade', CHOCOLATE_PRICE)
    notForSaleId = await createProduct('Utgått testvare', 5_00, false)

    const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    shoppersGroupId = (await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order,
            manualGroup: { create: { name: 'purchase-shoppers', shortName: 'purchase-shoppers' } },
            permissions: { create: { permission: 'PURCHASE_USE' } },
        },
    })).id
})

/** A user with a student card and money on their account, allowed to shop unless told otherwise. */
async function createBuyer(username: string, { mayShop = true } = {}) {
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
    const studentCard = `card-${username}`
    await prisma.user.update({ where: { id: user.id }, data: { studentCard } })

    if (mayShop) {
        const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
        await prisma.membership.create({
            data: { groupId: shoppersGroupId, userId: user.id, order, admin: false, active: true },
        })
    }

    const account = await ledgerAccountOperations.read({ params: { userId: user.id }, bypassAuth: true })
    await ledgerMovementOperations.createDeposit({
        params: { ledgerAccountId: account.id, provider: 'MANUAL', funds: STARTING_BALANCE, manualFees: 0 },
        bypassAuth: true,
    })

    return { studentCard, accountId: account.id }
}

const balanceOf = async (ledgerAccountId: number) => (await ledgerAccountOperations.calculateBalance({
    params: { ledgerAccountId },
    bypassAuth: true,
})).amount

const countPurchases = () => prisma.purchase.count({ where: { shopId } })

const buy = (studentCard: string, products: { id: number, quantity: number }[], session = kioskSession) =>
    purchaseOperations.createByStudentCard({
        data: { shopId, studentCard, products },
        session,
    })

describe('buying with a student card', () => {
    test('moves the price of the purchase from the buyer to the shop', async () => {
        const buyer = await createBuyer('purchaseone')
        const shopBalanceBefore = await balanceOf(shopAccountId)
        const purchasesBefore = await countPurchases()

        const result = await buy(buyer.studentCard, [
            { id: sodaId, quantity: 2 },
            { id: chocolateId, quantity: 1 },
        ])

        const total = 2 * SODA_PRICE + CHOCOLATE_PRICE
        expect(result.remainingBalance).toBe(STARTING_BALANCE - total)
        expect(await balanceOf(buyer.accountId)).toBe(STARTING_BALANCE - total)
        expect(await balanceOf(shopAccountId)).toBe(shopBalanceBefore + total)
        expect(await countPurchases()).toBe(purchasesBefore + 1)
    })

    test('a purchase the buyer cannot afford is refused and leaves nothing behind', async () => {
        const buyer = await createBuyer('purchasetwo')
        const shopBalanceBefore = await balanceOf(shopAccountId)
        const purchasesBefore = await countPurchases()

        await expect(buy(buyer.studentCard, [{ id: chocolateId, quantity: 6 }]))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        expect(await balanceOf(buyer.accountId)).toBe(STARTING_BALANCE)
        expect(await balanceOf(shopAccountId)).toBe(shopBalanceBefore)
        expect(await countPurchases()).toBe(purchasesBefore)
    })

    test('the buyer can spend exactly what they have', async () => {
        const buyer = await createBuyer('purchasethree')

        const result = await buy(buyer.studentCard, [{ id: chocolateId, quantity: 5 }])

        expect(result.remainingBalance).toBe(0)
        await expect(buy(buyer.studentCard, [{ id: sodaId, quantity: 1 }]))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await balanceOf(buyer.accountId)).toBe(0)
    })

    test('a product the shop does not sell is refused', async () => {
        const buyer = await createBuyer('purchasefour')
        const purchasesBefore = await countPurchases()

        await expect(buy(buyer.studentCard, [{ id: notForSaleId, quantity: 1 }]))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        expect(await balanceOf(buyer.accountId)).toBe(STARTING_BALANCE)
        expect(await countPurchases()).toBe(purchasesBefore)
    })

    test('the owner of the card must be allowed to shop', async () => {
        const buyer = await createBuyer('purchasefive', { mayShop: false })
        const purchasesBefore = await countPurchases()

        await expect(buy(buyer.studentCard, [{ id: sodaId, quantity: 1 }])).rejects.toThrow(Smorekopp)

        expect(await balanceOf(buyer.accountId)).toBe(STARTING_BALANCE)
        expect(await countPurchases()).toBe(purchasesBefore)
    })

    test('only a session with PURCHASE_ADMIN may charge a card', async () => {
        const buyer = await createBuyer('purchasesix')
        const purchasesBefore = await countPurchases()
        const notTheKiosk = Session.fromJsObject({ user: null, permissions: ['PURCHASE_USE'], memberships: [] })

        await expect(buy(buyer.studentCard, [{ id: sodaId, quantity: 1 }], notTheKiosk)).rejects.toThrow(Smorekopp)

        expect(await balanceOf(buyer.accountId)).toBe(STARTING_BALANCE)
        expect(await countPurchases()).toBe(purchasesBefore)
    })
})
