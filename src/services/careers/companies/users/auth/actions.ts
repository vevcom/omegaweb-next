'use server'
import { companyUserAuthOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const sendCompanyUserPasswordLinkAction = makeAction(companyUserAuthOperations.sendPasswordLink)
export const sendCompanyUserResetPasswordEmailAction = makeAction(companyUserAuthOperations.sendResetPasswordEmail)
export const chooseCompanyUserPasswordAction = makeAction(companyUserAuthOperations.choosePassword)
export const registerNewCompanyUserEmailAction = makeAction(companyUserAuthOperations.registerNewEmail)
export const verifyCompanyUserEmailAction = makeAction(companyUserAuthOperations.verifyEmail)
