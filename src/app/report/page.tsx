import styles from './page.module.scss'
import {
    updateReportArticleAction,
    updateReportArticleAddSectionAction,
    updateReportArticleCmsImageAction,
    updateReportArticleCmsLinkAction,
    updateReportArticleCmsParagraphAction,
    updateReportArticleCoverImageAction,
    updateReportArticleReorderSectionsAction,
    updateReportArticleSectionAction,
    updateReportArticleSectionsAddPartAction,
    updateReportArticleSectionsRemovePartAction
} from '@/services/report/actions'
import { reportOperations } from '@/services/report/operations'
import SpecialArticle from '@/cms/SpecialArticle/SpecialArticle'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { reportAuth } from '@/services/report/auth'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => reportOperations.read({}),
    capabilities: () => ({
        canEdit: reportAuth.update,
    }),
    metadata: () => ({ title: 'Varsling' }),
    render: ({ data: article, capabilities }) => (
        <PageWrapper className={styles.reportPage}>
            <SpecialArticle
                article={article}
                capabilities={capabilities}
                actions={{
                    update: updateReportArticleAction,
                    addSection: updateReportArticleAddSectionAction,
                    reorderSections: updateReportArticleReorderSectionsAction,
                    coverImage: updateReportArticleCoverImageAction,
                    articleSections: {
                        update: updateReportArticleSectionAction,
                        addPart: updateReportArticleSectionsAddPartAction,
                        removePart: updateReportArticleSectionsRemovePartAction,
                        cmsImage: updateReportArticleCmsImageAction,
                        cmsParagraph: updateReportArticleCmsParagraphAction,
                        cmsLink: updateReportArticleCmsLinkAction,
                    }
                }}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
