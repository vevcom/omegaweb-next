import '@ow-server-only'
import { frontpageAuth } from './auth'
import { implementSpecialCmsParagraphs } from '@/cms/paragraphs/implement'
import { implementSpecialCmsImages } from '@/cms/images/implement'
import { implementSpecialCmsLinks } from '@/cms/links/implement'

export const frontpageOperations = {
    cmsParagraphs: implementSpecialCmsParagraphs({
        specials: ['FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4'],
        authorizers: frontpageAuth.cmsParagraphs,
    }),

    cmsImages: implementSpecialCmsImages({
        specials: ['FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4'],
        authorizers: frontpageAuth.cmsImages,
    }),

    cmsLinks: implementSpecialCmsLinks({
        specials: ['FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4'],
        authorizers: frontpageAuth.cmsLinks,
    }),
} as const
