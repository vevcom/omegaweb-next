'use server'
import { makeAction } from '@/services/serverAction'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'

export const sendMailFromAliasAction = makeAction(sendMailOperations.sendMailFromAlias)
