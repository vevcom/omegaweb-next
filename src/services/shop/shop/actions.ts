'use server'
import { makeAction } from '@/services/serverAction'
import { shopOperations } from '@/services/shop/shop/operations'

export const createShopAction = makeAction(shopOperations.create)
export const updateShopAction = makeAction(shopOperations.update)
export const connectShopToLedgerAction = makeAction(shopOperations.connectToLedger)
export const updateShopRegularLevelVisibilityAction = makeAction(shopOperations.visibility.updateRegularLevel)
export const updateShopAdminLevelVisibilityAction = makeAction(shopOperations.visibility.updateAdminLevel)
