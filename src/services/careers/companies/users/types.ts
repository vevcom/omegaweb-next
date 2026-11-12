import type { companyUserSelection, companyUserWithCompanySelection } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type CompanyUserFiltered = Prisma.CompanyUserGetPayload<{ select: typeof companyUserSelection }>

export type CompanyUserWithCompany = Prisma.CompanyUserGetPayload<{ select: typeof companyUserWithCompanySelection }>
