'use server'
import { makeAction } from '@/services/serverAction'
import { aliasMailAddressOperations, aliasOperations } from '@/services/mail/alias/operations'

export const createMailAliasAction = makeAction(aliasOperations.create)
export const updateMailAliasAddressAction = makeAction(aliasMailAddressOperations.update)
export const updateMailAliasDescriptionAction = makeAction(aliasOperations.updateDescription)
export const updateMailAliasAddressForwardingAction = makeAction(aliasMailAddressOperations.updateForwarding)
export const updateMailAliasVisibilityAction = makeAction(aliasOperations.visibility.update)
export const destroyMailAliasAction = makeAction(aliasOperations.destroy)
