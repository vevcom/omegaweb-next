import type { ExpandedArticleSection } from '@/cms/articleSections/types'
import type { InterestGroup } from '@/prisma-generated-pn-types'

export type ExpandedInterestGroup = InterestGroup & {
    articleSection: ExpandedArticleSection
    group: { pensioned: boolean }
}
