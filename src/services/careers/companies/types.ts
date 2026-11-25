import type { companySchemas } from './schemas'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { Company } from '@/prisma-generated-pn-types'

export type CompanyCursor = InferPagingCursor<typeof companySchemas.params.readPage>

export type CompanyDetails = InferPagingDetails<typeof companySchemas.params.readPage>

export type CompanyExpanded = Company & {
    logoImage: ExpandedImage | null
}

export type SponsorCompany = Pick<Company, 'id' | 'name' | 'website' | 'sponsorTier'> & {
    logoImage: ExpandedImage | null
}
