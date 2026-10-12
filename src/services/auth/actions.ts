'use server'

import { makeAction } from '@/services/serverAction'
import { authOperations } from '@/services/auth/operations'

export const verifyResetPasswordTokenAction = makeAction(authOperations.verifyResetPasswordToken)
export const resetPasswordAction = makeAction(authOperations.resetPassword)
export const sendResetPasswordEmailAction = makeAction(authOperations.sendResetPasswordEmail)
export const sendLinkFeideAccountEmailAction = makeAction(authOperations.sendLinkFeideAccountEmail)
export const verifyLinkFeideAccountTokenAction = makeAction(authOperations.verifyLinkFeideAccountToken)
export const linkFeideAccountAction = makeAction(authOperations.linkFeideAccount)
export const adminLinkFeideAccountAction = makeAction(authOperations.adminLinkFeideAccount)
