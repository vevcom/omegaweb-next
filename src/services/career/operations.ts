import '@pn-server-only'
import { careerAuth } from './auth'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsLinkOperations } from '@/cms/links/operations'

export const careerOperations = {
    readSpecialCmsParagraphCareerInfo: cmsParagraphOperations.readSpecial.implement({
        authorizer: () => careerAuth.readSpecialCmsParagraphCareerInfo,
        ownershipCheck: ({ params }) => params.special === 'CAREER_INFO'
    }),

    updateSpecialCmsParagraphContentCareerInfo: cmsParagraphOperations.updateContent.implement({
        authorizer: () => careerAuth.updateSpecialCmsParagraphContentCareerInfo,
        ownershipCheck: async ({ params }) =>
            await cmsParagraphOperations.isSpecial.internalCall({
                params: { paragraphId: params.paragraphId, special: ['CAREER_INFO'] },
            })
    }),

    readSpecialCmsLink: cmsLinkOperations.readSpecial.implement({
        authorizer: () => careerAuth.readSpecialCmsLink,
        ownershipCheck: ({ params }) => params.special === 'CAREER_LINK_TO_CONTACTOR'
    }),

    updateSpecialCmsLink: cmsLinkOperations.update.implement({
        authorizer: () => careerAuth.updateSpecialCmsLink,
        ownershipCheck: ({ params }) =>
            cmsLinkOperations.isSpecial.internalCall({
                params: {
                    linkId: params.linkId,
                    special: ['CAREER_LINK_TO_CONTACTOR']
                }
            })
    }),
} as const
