import '@pn-server-only'
import { purchaseAuth } from './auth'
import { purchaseSchemas } from './schemas'
import { ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { userOperations } from '@/services/users/operations'
import { groupOperations } from '@/services/groups/operations'
import { shopOperations } from '@/services/shop/shop/operations'
import { userBasicSelection } from '@/services/users/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { PurchaseMethod } from '@/prisma-generated-pn-types'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

type PurchaseImplementation = 'create' | 'createOnBehalf'

/**
 * The one way a purchase is made: the buyer is a user id, however the caller got hold of it.
 * Implemented as `create` (the session user buying for themselves) and `createOnBehalf` (the
 * kiosk charging the owner of a student card).
 */
const createPurchase = defineSubOperation({
    // Each implementation reads the schemas under its own name.
    paramsSchema: ({ operation }: { operation: PurchaseImplementation }) => purchaseSchemas.params[operation],
    dataSchema: ({ operation }: { operation: PurchaseImplementation }) => purchaseSchemas.data[operation],
    opensTransaction: true,
    operation: ({ method }: { method: PurchaseMethod }) => async ({ prisma, params, data }) => {
        const user = await prisma.user.findUniqueOrThrow({
            where: {
                id: params.userId,
            },
            select: userBasicSelection,
        })

        const shop = await prisma.shop.findUniqueOrThrow({
            where: { id: data.shopId },
            select: { ledgerAccountId: true },
        })
        const shopAccountId = shop.ledgerAccountId
        if (!shopAccountId) {
            throw new ServiceError('SERVER ERROR', 'Denne butikken har ingen tilknyttet konto.')
        }

        // The unit prices the shop sells the products at. A product it does not sell, or has
        // taken off sale, is missing from the list, which the count check catches.
        const shopProducts = await prisma.shopProduct.findMany({
            where: {
                shopId: data.shopId,
                active: true,
                productId: { in: data.products.map(product => product.id) },
            },
        })
        if (shopProducts.length !== data.products.length) {
            throw new ServiceError('BAD PARAMETERS', 'Noen av produktene selges ikke i denne butikken.')
        }

        const unitPrices = Object.fromEntries(
            shopProducts.map(shopProduct => [shopProduct.productId, shopProduct.price])
        )

        // Each line is charged at its unit price - the line total is price * quantity.
        const productList = data.products.map(product => ({
            productId: product.id,
            quantity: product.quantity,
            price: unitPrices[product.id] ?? 0,
        }))

        const totalPrice = productList.reduce((sum, product) => sum + product.price * product.quantity, 0)

        const buyerAccount = await ledgerAccountOperations.read({
            params: { userId: user.id },
            bypassAuth: true,
        })

        await prisma.$transaction(async tx => {
            const purchase = await tx.purchase.create({
                data: {
                    shop: {
                        connect: {
                            id: data.shopId,
                        },
                    },
                    method,
                    PurchaseProduct: {
                        createMany: {
                            data: productList,
                        },
                    },
                },
            })

            if (totalPrice === 0) return

            // bypassAuth: who pays has already been decided by the authorizer of the implementation
            // (`create`: the session user, buying for themselves in a shop they can see;
            // `createOnBehalf`: the kiosk, charging a card whose owner may shop there). The generic
            // ledger-ownership check would reject the kiosk outright, as its API-key session owns
            // no account - the same precedent as ledgerTransactionOperations.advance's own bypass.
            const transaction: ExpandedLedgerTransaction = await ledgerTransactionOperations.create({
                params: {
                    purpose: 'SHOP_PURCHASE',
                    ledgerEntries: [
                        { ledgerAccountId: shopAccountId, funds: totalPrice },
                        { ledgerAccountId: buyerAccount.id, funds: -totalPrice },
                    ],
                    purchaseId: purchase.id,
                },
                prisma: tx,
                bypassAuth: true,
            })

            if (transaction.state === 'FAILED') {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    transaction.reason ?? 'Kjøpet kunne ikke fullføres.'
                )
            }
        })

        const remainingBalance = await ledgerAccountOperations.calculateBalance({
            params: { ledgerAccountId: buyerAccount.id },
            bypassAuth: true,
        })

        return {
            remainingBalance: remainingBalance.amount,
            user,
            productList,
        }
    },
})

/**
 * The kiosk buying for a user it has identified, charged to that user's account. Defined outside
 * the operations object so `createByStudentCard` can call it without referring to the object.
 */
const createOnBehalf = createPurchase.implement({
    authorizer: async ({ params, data, prisma }) => {
        const [membershipsOfUser, visibility] = await Promise.all([
            groupOperations.readMembershipsOfUserOfAllTypes.internalCall({ params: { userId: params.userId } }),
            shopOperations.visibility.readDoubleLevelMatrixInternal({ params: { shopId: data.shopId }, prisma }),
        ])
        return purchaseAuth.createOnBehalf.data({ membershipsOfUser, visibility })
    },
    ownershipCheck: () => true,
    paramsSchemaImplementationFields: { operation: 'createOnBehalf' },
    dataSchemaImplementationFields: { operation: 'createOnBehalf' },
    operationImplementationFields: { method: PurchaseMethod.STUDENT_CARD },
})

export const purchaseOperations = {
    create: createPurchase.implement({
        authorizer: async ({ params, data, prisma }) => purchaseAuth.create.data({
            userId: params.userId,
            visibility: await shopOperations.visibility.readDoubleLevelMatrixInternal({
                params: { shopId: data.shopId },
                prisma,
            }),
        }),
        ownershipCheck: () => true,
        paramsSchemaImplementationFields: { operation: 'create' },
        dataSchemaImplementationFields: { operation: 'create' },
        operationImplementationFields: { method: PurchaseMethod.WEB },
    }),

    createOnBehalf,

    /**
     * Resolves a student card to its owner and buys on their behalf. The caller's permission is
     * checked before the card is looked up, so the endpoint tells no one else whether a card is
     * bound to a user; the owner's own access to the shop is checked by `createOnBehalf`.
     */
    createByStudentCard: defineOperation({
        authorizer: () => purchaseAuth.createByStudentCard,
        dataSchema: purchaseSchemas.data.createByStudentCard,
        opensTransaction: true,
        operation: async ({ data }) => {
            const user = await readCardOwner(data.studentCard)
            return createOnBehalf({
                params: { userId: user.id },
                data: { shopId: data.shopId, products: data.products },
            })
        },
    }),
} as const

/** The user a student card is bound to, with the kiosk's own message when there is none. */
async function readCardOwner(studentCard: string) {
    try {
        return await userOperations.read({
            params: { studentCard },
            bypassAuth: true,
        })
    } catch (error) {
        if (error instanceof ServiceError && error.errorCode === 'NOT FOUND') {
            throw new ServiceError('NOT FOUND', 'Ingen brukere er koblet til studentkortet.')
        }
        throw error
    }
}
