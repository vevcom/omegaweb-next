'use server'

import { makeAction } from '@/services/serverAction'
import { companyOperations } from '@/services/career/companies/operations'

export const createCompanyAction = makeAction(companyOperations.create)

export const destroyCompanyAction = makeAction(companyOperations.destroy)

export const readCompanyPageAction = makeAction(companyOperations.readPage)

export const updateCompanyAction = makeAction(companyOperations.update)

export const updateCompanySponsorTierAction = makeAction(companyOperations.updateSponsorTier)

export const updateCompanyCmsLogoAction = makeAction(companyOperations.updateCmsImageLogo)
