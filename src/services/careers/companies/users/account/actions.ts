'use server'
import { companyUserAccountOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const sendCompanyUserPasswordLinkAction = makeAction(companyUserAccountOperations.sendPasswordLink)
export const sendCompanyUserResetPasswordEmailAction = makeAction(companyUserAccountOperations.sendResetPasswordEmail)
export const chooseCompanyUserPasswordAction = makeAction(companyUserAccountOperations.choosePassword)
