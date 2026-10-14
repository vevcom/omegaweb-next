import type { ExpandedCmsImage } from '@/cms/images/types'
import type { schoolFieldsToExpose } from './constants'
import type { schoolSchemas } from './schemas'
import type { InferPagingCursor } from '@/lib/paging/schema'
import type { CmsLink, CmsParagraph, School } from '@/prisma-generated-pn-types'

export type SchoolFiltered = Pick<School, typeof schoolFieldsToExpose[number]>

export type ExpandedSchool = SchoolFiltered & {
    cmsImage: ExpandedCmsImage,
    cmsParagraph: CmsParagraph,
    cmsLink: CmsLink,
}

export type SchoolCursor = InferPagingCursor<typeof schoolSchemas.params.readExpandedPage>
