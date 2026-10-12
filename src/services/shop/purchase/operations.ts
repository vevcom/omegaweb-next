import '@pn-server-only'
import { purchaseAuth } from './auth'
import { purchaseSchemas } from './schemas'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { userOperations } from '@/services/users/operations'
import { permissionOperations } from '@/services/permissions/operations'
import { userBasicSelection } from '@/services/users/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { PurchaseMethod } from '@/prisma-generated-pn-types'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

export const purchaseOperations = {
    createByStudentCard: defineOperation({
        authorizer: async ({ data }) => {
            let user
            try {
                user = await userOperations.read({
                    params: {
                        studentCard: data.studentCard,
                    },
                    bypassAuth: true,
                })
            } catch (e) {
                if (e instanceof ServiceError && e.errorCode === 'NOT FOUND') {
                    throw new ServiceError('NOT FOUND', 'Ingen brukere er koblet til studentkortet.')
                }
                throw e
            }

            const permissions = await permissionOperations.readPermissionsOfUser({
                params: {
                    userId: user.id,
                },
                bypassAuth: true,
            })

            return purchaseAuth.createByStudentCard.data({ permissionsOfUser: permissions })
        },
        dataSchema: purchaseSchemas.createFromStudentCard,
        opensTransaction: true,
        operation: async ({ prisma, data }) => {
            if (data.products.length === 0) {
                throw new ServiceError('BAD PARAMETERS', 'The list of products to buy cannot be empty')
            }

            const user = await prisma.user.findUniqueOrThrow({
                where: {
                    studentCard: data.studentCard,
                },
                select: userBasicSelection,
            })

            const shop = await prisma.shop.findUniqueOrThrow({
                where: { id: data.shopId },
                select: { ledgerAccountId: true },
            })
            if (!shop.ledgerAccountId) {
                throw new ServiceError('SERVER ERROR', 'Denne butikken har ingen tilknyttet konto.')
            }

            // Find the price of the different products
            const productPrices = await prisma.shopProduct.findMany({
                where: {
                    shopId: data.shopId,
                    active: true,
                    OR: data.products.map(product => ({
                        productId: product.id,
                    }))
                }
            })

            if (productPrices.length !== data.products.length) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'The product list contains invalid product ids for the specified shop'
                )
            }

            const productPriceMap = Object.fromEntries(
                productPrices.map(product => ([product.productId, product.price]))
            )

            // Note: price here is a *unit* price - the line total is price * quantity.
            const productList = data.products.map(product => ({
                productId: product.id,
                quantity: product.quantity,
                price: productPriceMap[product.id] ?? 0
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
                        method: PurchaseMethod.STUDENT_CARD,
                        PurchaseProduct: {
                            createMany: {
                                data: productList,
                            }
                        }
                    }
                })

                if (totalPrice === 0) return

                // bypassAuth: the outer authorizer (an API-key session with
                // PURCHASE_ADMIN, paying on behalf of a user with PURCHASE_USE)
                // already replaces the generic ledger-ownership check, which would otherwise
                // reject this API-key session outright since it owns no ledger account itself -
                // the same precedent as ledgerTransactionOperations.advance's own bypass.
                const transaction: ExpandedLedgerTransaction = await ledgerTransactionOperations.create({
                    params: {
                        purpose: 'SHOP_PURCHASE',
                        ledgerEntries: [
                            { ledgerAccountId: shop.ledgerAccountId!, funds: totalPrice },
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
        }
    })
} as const
