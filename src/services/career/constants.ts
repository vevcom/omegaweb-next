import type { SpecialCmsImage, SpecialCmsParagraph } from '@/prisma-generated-pn-types'

/** The special CMS content the career frontpage owns: the hero of Contactor's frontpage and its intro. */
export const careerCmsParagraphs: Readonly<SpecialCmsParagraph[]> = ['CAREER_HERO', 'CAREER_INFO']

export const careerCmsImages: Readonly<SpecialCmsImage[]> = ['CAREER_HERO']
