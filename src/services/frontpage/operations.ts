import '@pn-server-only'
import { frontpageAuth } from './auth'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import type { SpecialCmsImage, SpecialCmsParagraph } from '@/prisma-generated-pn-types'

const ownedCmsParagraphs: Readonly<SpecialCmsParagraph[]> = [
    'FRONTPAGE_1',
    'FRONTPAGE_2',
    'FRONTPAGE_3',
    'FRONTPAGE_4',
]

const ownedCmsImages: Readonly<SpecialCmsImage[]> = [
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
} as const
