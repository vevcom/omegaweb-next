import type { SpecialCmsImage, SpecialCmsLink, SpecialCmsParagraph } from '@/prisma-generated-pn-types'

/**
 * The special CMS content of the career frontpage: the "who we represent"
 * section (an intro and one paragraph per study programme), the "about us" section, and the links
 * to the study programmes and to getting in touch.
 */
export const careersFrontpageCmsParagraphs: readonly SpecialCmsParagraph[] = [
    'CAREER_ABOUT',
    'CAREER_PROGRAMMES',
    'CAREER_PROGRAMME_CYBERNETICS',
    'CAREER_PROGRAMME_ELECTRONICS',
]

export const careersFrontpageCmsImages: readonly SpecialCmsImage[] = ['CAREER_ABOUT']

export const careersFrontpageCmsLinks: readonly SpecialCmsLink[] = [
    'CAREER_CONTACT',
    'CAREER_CYBERNETICS_FIVE_YEAR',
    'CAREER_CYBERNETICS_TWO_YEAR',
    'CAREER_ELECTRONICS_FIVE_YEAR',
    'CAREER_ELECTRONICS_TWO_YEAR',
]
