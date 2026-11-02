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
} from '@/services/revue/actions'
import { revueOperations } from '@/services/revue/operations'
import SpecialArticle from '@/cms/SpecialArticle/SpecialArticle'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { revueAuth } from '@/services/revue/auth'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async () => revueOperations.mainRevueInfo.read({}),
    capabilities: () => ({
        canEdit: revueAuth.updateMainRevueInfo,
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
