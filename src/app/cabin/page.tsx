import {
    updateCabinArticleAction,
    updateCabinArticleAddSectionAction,
    updateCabinArticleCmsImageAction,
    updateCabinArticleCmsLinkAction,
    updateCabinArticleCmsParagraphAction,
    updateCabinArticleCoverImageAction,
    updateCabinArticleReorderSectionsAction,
    updateCabinArticleSectionAction,
    updateCabinArticleSectionsAddPartAction,
    updateCabinArticleSectionsRemovePartAction
} from '@/services/cabin/article/actions'
import { cabinArticleOperations } from '@/services/cabin/article/operations'
import SpecialArticle from '@/cms/SpecialArticle/SpecialArticle'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { cabinArticleAuth } from '@/services/cabin/article/auth'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'

const { page, generateMetadata } = serverPage({
    operation: async () => cabinArticleOperations.read({}),
    capabilities: () => ({
        canEdit: cabinArticleAuth.update,
    }),
    metadata: () => ({ title: 'Heutten' }),
    render: ({ data: article, capabilities }) => (
        <PageWrapper headerItem={<Link href="/cabin/book">Trykk her for å Booke</Link>}>
            <SpecialArticle
                article={article}
                capabilities={capabilities}
                actions={{
                    update: updateCabinArticleAction,
                    addSection: updateCabinArticleAddSectionAction,
                    reorderSections: updateCabinArticleReorderSectionsAction,
                    coverImage: updateCabinArticleCoverImageAction,
                    articleSections: {
                        update: updateCabinArticleSectionAction,
                        addPart: updateCabinArticleSectionsAddPartAction,
                        removePart: updateCabinArticleSectionsRemovePartAction,
                        cmsImage: updateCabinArticleCmsImageAction,
                        cmsParagraph: updateCabinArticleCmsParagraphAction,
                        cmsLink: updateCabinArticleCmsLinkAction,
                    }
                }}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
