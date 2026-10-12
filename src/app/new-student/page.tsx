import {
    updateNewStudentArticleAction,
    updateNewStudentArticleAddSectionAction,
    updateNewStudentArticleCmsImageAction,
    updateNewStudentArticleCmsLinkAction,
    updateNewStudentArticleCmsParagraphAction,
    updateNewStudentArticleCoverImageAction,
    updateNewStudentArticleReorderSectionsAction,
    updateNewStudentArticleSectionAction,
    updateNewStudentArticleSectionsAddPartAction,
    updateNewStudentArticleSectionsRemovePartAction
} from '@/services/newStudent/actions'
import { newStudentOperations } from '@/services/newStudent/operations'
import SpecialArticle from '@/cms/SpecialArticle/SpecialArticle'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { newStudentAuth } from '@/services/newStudent/auth'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => newStudentOperations.read({}),
    capabilities: () => ({
        canEdit: newStudentAuth.update,
    }),
    metadata: () => ({ title: 'Ny student' }),
    render: ({ data: article, capabilities }) => (
        <PageWrapper>
            <SpecialArticle
                article={article}
                capabilities={capabilities}
                actions={{
                    update: updateNewStudentArticleAction,
                    addSection: updateNewStudentArticleAddSectionAction,
                    reorderSections: updateNewStudentArticleReorderSectionsAction,
                    coverImage: updateNewStudentArticleCoverImageAction,
                    articleSections: {
                        update: updateNewStudentArticleSectionAction,
                        addPart: updateNewStudentArticleSectionsAddPartAction,
                        removePart: updateNewStudentArticleSectionsRemovePartAction,
                        cmsImage: updateNewStudentArticleCmsImageAction,
                        cmsParagraph: updateNewStudentArticleCmsParagraphAction,
                        cmsLink: updateNewStudentArticleCmsLinkAction,
                    }
                }}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
