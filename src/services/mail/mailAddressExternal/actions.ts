'use server'
import { makeAction } from '@/services/serverAction'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'

export const createMailAddressExternalAction = makeAction(mailAddressExternalOperations.create)
export const updateMailAddressExternalAction = makeAction(mailAddressExternalOperations.update)
export const destroyMailAddressExternalAction = makeAction(mailAddressExternalOperations.destroy)
