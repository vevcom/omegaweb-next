'use server'
import { makeAction } from '@/services/serverAction'
import { mailOperations } from '@/services/mail/operations'

export const createAliasMailingListRelationAction = makeAction(mailOperations.createAliasMailingListRelation)
export const createMailingListExternalRelationAction = makeAction(mailOperations.createMailingListExternalRelation)
export const createMailingListUserRelationAction = makeAction(mailOperations.createMailingListUserRelation)
export const createMailingListGroupRelationAction = makeAction(mailOperations.createMailingListGroupRelation)

export const destroyAliasMailingListRelationAction = makeAction(mailOperations.destroyAliasMailingListRelation)
export const destroyMailingListExternalRelationAction = makeAction(mailOperations.destroyMailingListExternalRelation)
export const destroyMailingListUserRelationAction = makeAction(mailOperations.destroyMailingListUserRelation)
export const destroyMailingListGroupRelationAction = makeAction(mailOperations.destroyMailingListGroupRelation)

export const readMailOptionsAction = makeAction(mailOperations.readMailOptions)
