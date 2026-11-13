'use server'
import { companyUserOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createCompanyUserAction = makeAction(companyUserOperations.create)
export const updateCompanyUserAction = makeAction(companyUserOperations.update)
export const updateCompanyUserRoleAction = makeAction(companyUserOperations.updateRole)
export const destroyCompanyUserAction = makeAction(companyUserOperations.destroy)
