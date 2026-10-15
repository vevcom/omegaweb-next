import type { CmsParagraph, Ombul } from '@/prisma-generated-pn-types'
import type { ExpandedImage } from '@/services/images/subservice/types'

export type ExpandedOmbul = Ombul & {
    coverImage: ExpandedImage
    paragraph: CmsParagraph
}
