import {
    updateMainRevueInfoAction,
    updateMainRevueInfoAddSectionAction,
    updateMainRevueInfoCmsImageAction,
    updateMainRevueInfoCmsLinkAction,
    updateMainRevueInfoCmsParagraphAction,
    updateMainRevueInfoCoverImageAction,
    updateMainRevueInfoReorderSectionsAction,
    updateMainRevueInfoSectionAction,
    updateMainRevueInfoSectionsAddPartAction,
    updateMainRevueInfoSectionsRemovePartAction
} from '@/services/revue/frontpage/actions'
import { revueFrontpageOperations } from '@/services/revue/frontpage/operations'
import SpecialArticle from '@/cms/SpecialArticle/SpecialArticle'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { revueFrontpageAuth } from '@/services/revue/frontpage/auth'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async () => revueFrontpageOperations.mainRevueInfo.read({}),
    capabilities: () => ({
        canEdit: revueFrontpageAuth.updateMainRevueInfo,
    }),
    // Absolute: the frontpage is the site, so the layout's template would read "Omegarevyen | Omegarevyen".
    metadata: () => ({ title: { absolute: 'Omegarevyen' } }),
    render: ({ data: article, capabilities }) => (
        <PageWrapper>
            <SpecialArticle
                article={article}
                capabilities={capabilities}
                actions={{
                    update: updateMainRevueInfoAction,
                    addSection: updateMainRevueInfoAddSectionAction,
                    reorderSections: updateMainRevueInfoReorderSectionsAction,
                    coverImage: updateMainRevueInfoCoverImageAction,
                    articleSections: {
                        update: updateMainRevueInfoSectionAction,
                        addPart: updateMainRevueInfoSectionsAddPartAction,
                        removePart: updateMainRevueInfoSectionsRemovePartAction,
                        cmsImage: updateMainRevueInfoCmsImageAction,
                        cmsParagraph: updateMainRevueInfoCmsParagraphAction,
                        cmsLink: updateMainRevueInfoCmsLinkAction,
                    }
                }}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
