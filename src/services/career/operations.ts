import '@pn-server-only'
import { careerAuth } from './auth'
import { careerCmsImages, careerCmsParagraphs } from './constants'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'

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
} as const
