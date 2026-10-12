'use server'

import { makeAction } from '@/services/serverAction'
import { productOperations } from '@/services/shop/product/operations'
import { shopOperations } from '@/services/shop/shop/operations'

export const createProductAction = makeAction(productOperations.create)
export const updateProductAction = makeAction(productOperations.update)

export const createProductForShopAction = makeAction(productOperations.createForShop)
export const updateProductForShopAction = makeAction(productOperations.updateForShop)

export const createShopProductConnectionAction = makeAction(productOperations.createShopConnection)

export const createShopAction = makeAction(shopOperations.create)
