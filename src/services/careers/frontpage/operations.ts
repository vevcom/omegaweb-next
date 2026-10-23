import '@pn-server-only'
import { careersFrontpageAuth } from './auth'
import { careersFrontpageCmsImages, careersFrontpageCmsLinks, careersFrontpageCmsParagraphs } from './constants'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsLinkOperations } from '@/cms/links/operations'

export const careersFrontpageOperations = {
    readSpecialCmsParagraph: cmsParagraphOperations.readSpecial.implement({
        authorizer: () => careersFrontpageAuth.readSpecialCmsParagraph,
        ownershipCheck: ({ params }) => careersFrontpageCmsParagraphs.includes(params.special)
    }),

    updateSpecialCmsParagraphContent: cmsParagraphOperations.updateContent.implement({
        authorizer: () => careersFrontpageAuth.updateSpecialCmsParagraphContent,
        ownershipCheck: ({ params }) => cmsParagraphOperations.isSpecial.internalCall({
            params: { paragraphId: params.paragraphId, special: [...careersFrontpageCmsParagraphs] },
        })
    }),

    readSpecialCmsImage: cmsImageOperations.readSpecial.implement({
        authorizer: () => careersFrontpageAuth.readSpecialCmsImage,
        ownershipCheck: ({ params }) => careersFrontpageCmsImages.includes(params.special)
    }),

    updateSpecialCmsImage: cmsImageOperations.update.implement({
        authorizer: () => careersFrontpageAuth.updateSpecialCmsImage,
        ownershipCheck: ({ params }) => cmsImageOperations.isSpecial.internalCall({
            params: { cmsImageId: params.cmsImageId, special: [...careersFrontpageCmsImages] },
        })
    }),

    readSpecialCmsLink: cmsLinkOperations.readSpecial.implement({
        authorizer: () => careersFrontpageAuth.readSpecialCmsLink,
        ownershipCheck: ({ params }) => careersFrontpageCmsLinks.includes(params.special)
    }),

    updateSpecialCmsLink: cmsLinkOperations.update.implement({
        authorizer: () => careersFrontpageAuth.updateSpecialCmsLink,
        ownershipCheck: ({ params }) => cmsLinkOperations.isSpecial.internalCall({
            params: { linkId: params.linkId, special: [...careersFrontpageCmsLinks] },
        })
    }),
} as const
