import '@pn-server-only'
import { careerAuth } from './auth'
import { careerCmsImages, careerCmsLinks, careerCmsParagraphs } from './constants'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsLinkOperations } from '@/cms/links/operations'

export const careerOperations = {
    readSpecialCmsParagraph: cmsParagraphOperations.readSpecial.implement({
        authorizer: () => careerAuth.readSpecialCmsParagraph,
        ownershipCheck: ({ params }) => careerCmsParagraphs.includes(params.special)
    }),

    updateSpecialCmsParagraphContent: cmsParagraphOperations.updateContent.implement({
        authorizer: () => careerAuth.updateSpecialCmsParagraphContent,
        ownershipCheck: ({ params }) => cmsParagraphOperations.isSpecial.internalCall({
            params: { paragraphId: params.paragraphId, special: [...careerCmsParagraphs] },
        })
    }),

    readSpecialCmsImage: cmsImageOperations.readSpecial.implement({
        authorizer: () => careerAuth.readSpecialCmsImage,
        ownershipCheck: ({ params }) => careerCmsImages.includes(params.special)
    }),

    updateSpecialCmsImage: cmsImageOperations.update.implement({
        authorizer: () => careerAuth.updateSpecialCmsImage,
        ownershipCheck: ({ params }) => cmsImageOperations.isSpecial.internalCall({
            params: { cmsImageId: params.cmsImageId, special: [...careerCmsImages] },
        })
    }),

    readSpecialCmsLink: cmsLinkOperations.readSpecial.implement({
        authorizer: () => careerAuth.readSpecialCmsLink,
        ownershipCheck: ({ params }) => careerCmsLinks.includes(params.special)
    }),

    updateSpecialCmsLink: cmsLinkOperations.update.implement({
        authorizer: () => careerAuth.updateSpecialCmsLink,
        ownershipCheck: ({ params }) => cmsLinkOperations.isSpecial.internalCall({
            params: { linkId: params.linkId, special: [...careerCmsLinks] },
        })
    }),
} as const
