import type { companySchemas } from './schemas'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'
import type { ExpandedCmsImage } from '@/cms/images/types'
import type { Company } from '@/prisma-generated-pn-types'

export type CompanyCursor = InferPagingCursor<typeof companySchemas.readPage>

export type CompanyDetails = InferPagingDetails<typeof companySchemas.readPage>

export type CompanyExpanded = Company & {
    logo: ExpandedCmsImage
}

export type SponsorCompany = Pick<Company, 'id' | 'name' | 'website' | 'sponsorTier'> & {
    logo: ExpandedCmsImage
}
