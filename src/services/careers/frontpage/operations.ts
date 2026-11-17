import '@pn-server-only'
import { careersFrontpageAuth } from './auth'
import { careersFrontpageCmsImages, careersFrontpageCmsLinks, careersFrontpageCmsParagraphs } from './constants'
import { implementSpecialCmsParagraphs } from '@/cms/paragraphs/implement'
import { implementSpecialCmsImages } from '@/cms/images/implement'
import { implementSpecialCmsLinks } from '@/cms/links/implement'

export const careersFrontpageOperations = {
    cmsParagraphs: implementSpecialCmsParagraphs({
        specials: careersFrontpageCmsParagraphs,
        authorizers: careersFrontpageAuth.cmsParagraphs,
    }),

    cmsImages: implementSpecialCmsImages({
        specials: careersFrontpageCmsImages,
        authorizers: careersFrontpageAuth.cmsImages,
    }),

    cmsLinks: implementSpecialCmsLinks({
        specials: careersFrontpageCmsLinks,
        authorizers: careersFrontpageAuth.cmsLinks,
    }),
} as const
