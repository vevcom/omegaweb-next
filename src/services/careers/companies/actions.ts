'use server'

import { makeAction } from '@/services/serverAction'
import { companyOperations } from '@/services/careers/companies/operations'

export const createCompanyAction = makeAction(companyOperations.create)

export const destroyCompanyAction = makeAction(companyOperations.destroy)

export const readCompanyPageAction = makeAction(companyOperations.readPage)

export const updateCompanyAction = makeAction(companyOperations.update)

export const updateCompanyNameAction = makeAction(companyOperations.updateName)

export const updateCompanySponsorTierAction = makeAction(companyOperations.updateSponsorTier)

export const updateCompanyLogoAction = makeAction(companyOperations.updateLogo)
