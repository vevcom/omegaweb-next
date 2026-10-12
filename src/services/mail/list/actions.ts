'use server'
import { makeAction } from '@/services/serverAction'
import { mailingListOperations } from '@/services/mail/list/operations'

export const createMailingListAction = makeAction(mailingListOperations.create)
export const updateMailingListAction = makeAction(mailingListOperations.update)
export const destroyMailingListAction = makeAction(mailingListOperations.destroy)
