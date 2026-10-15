'use server'
import { makeAction } from '@/services/serverAction'
import { productOperations } from '@/services/shop/product/operations'

export const createProductAction = makeAction(productOperations.create)
export const updateProductAction = makeAction(productOperations.update)
