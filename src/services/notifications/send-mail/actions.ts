'use server'
import { makeAction } from '@/services/serverAction'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'

export const sendMailAction = makeAction(sendMailOperations.sendMail)
