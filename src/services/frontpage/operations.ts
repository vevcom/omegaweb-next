import '@pn-server-only'
import { frontpageAuth } from './auth'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import type { SpecialCmsImage, SpecialCmsLink, SpecialCmsParagraph } from '@/prisma-generated-pn-types'

const ownedCmsParagraphs: readonly SpecialCmsParagraph[] = [
    'FRONTPAGE_1',
    'FRONTPAGE_2',
    'FRONTPAGE_3',
    'FRONTPAGE_4',
]

const ownedCmsImages: readonly SpecialCmsImage[] = [
    'FRONTPAGE_1',
    'FRONTPAGE_2',
    'FRONTPAGE_3',
    'FRONTPAGE_4',
]

const ownedCmsLinks: readonly SpecialCmsLink[] = [
    'FRONTPAGE_1',
    'FRONTPAGE_2',
    'FRONTPAGE_3',
    'FRONTPAGE_4',
]

export const frontpageOperations = {
    readSpecialCmsParagraphSection: cmsParagraphOperations.readSpecial.implement({
        authorizer: () => frontpageAuth.readSpecialCmsParagraphSection,
        ownershipCheck: ({ params }) => ownedCmsParagraphs.includes(params.special)
    }),

    updateSpecialCmsParagraphContentSection: cmsParagraphOperations.updateContent.implement({
        authorizer: () => frontpageAuth.updateSpecialCmsParagraphContentSection,
        ownershipCheck: async ({ params }) =>
            await cmsParagraphOperations.isSpecial.internalCall({
                params: {
                    paragraphId: params.paragraphId,
                    special: [...ownedCmsParagraphs],
                },
            })
    }),

    readSpecialCmsImage: cmsImageOperations.readSpecial.implement({
        authorizer: () => frontpageAuth.readSpecialCmsImage,
        ownershipCheck: ({ params }) => ownedCmsImages.includes(params.special)
    }),

    updateSpecialCmsImage: cmsImageOperations.update.implement({
        authorizer: () => frontpageAuth.updateSpecialCmsImage,
        ownershipCheck: async ({ params }) =>
            await cmsImageOperations.isSpecial.internalCall({
                params: {
                    cmsImageId: params.cmsImageId,
                    special: [...ownedCmsImages],
                },
            })
    }),

    readSpecialCmsLink: cmsLinkOperations.readSpecial.implement({
        authorizer: () => frontpageAuth.readSpecialCmsLink,
        ownershipCheck: ({ params }) => ownedCmsLinks.includes(params.special)
    }),

    updateSpecialCmsLink: cmsLinkOperations.update.implement({
        authorizer: () => frontpageAuth.updateSpecialCmsLink,
        ownershipCheck: async ({ params }) =>
            await cmsLinkOperations.isSpecial.internalCall({
                params: {
                    linkId: params.linkId,
                    special: [...ownedCmsLinks],
                },
            })
    }),
} as const
