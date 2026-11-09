'use server'
import { makeAction } from '@/services/serverAction'
import { aliasOperations } from '@/services/mail/alias/operations'

export const createMailAliasAction = makeAction(aliasOperations.create)
export const updateMailAliasAction = makeAction(aliasOperations.update)
export const updateMailAliasDescriptionAction = makeAction(aliasOperations.updateDescription)
export const updateMailAliasMailboxAction = makeAction(aliasOperations.updateMailbox)
export const updateMailAliasVisibilityAction = makeAction(aliasOperations.visibility.update)
export const destroyMailAliasAction = makeAction(aliasOperations.destroy)
