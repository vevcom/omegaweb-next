import CreateRevue from './CreateRevue'
import { revueLinks } from '@/app/(revue)/links'
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
import { revueOperations } from '@/services/revue/operations'
import SpecialArticle from '@/cms/SpecialArticle/SpecialArticle'
import ImageCard from '@/components/ImageCard/ImageCard'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import SiteLink from '@/components/SiteLink/SiteLink'
import { revueFrontpageAuth } from '@/services/revue/frontpage/auth'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async () => ({
        article: await revueFrontpageOperations.mainRevueInfo.read({}),
        revues: await revueOperations.readMany({}),
    }),
    capabilities: () => ({
        canEdit: revueFrontpageAuth.updateMainRevueInfo,
    }),
    // Absolute: the frontpage is the site, so the layout's template would read "Omegarevyen | Omegarevyen".
    metadata: () => ({ title: { absolute: 'Omegarevyen' } }),
    render: ({ data: { article, revues: [currentRevue, ...earlierRevues] }, capabilities }) => (
        <PageWrapper>
            {currentRevue && (
                <SiteLink
                    href={revueLinks.revue(currentRevue)}
                    className="
                        block mb-4 p-4 rounded-round bg-surface-raised text-inherit transition-colors
                        hover:bg-surface-hover hover:no-underline
                    "
                >
                    <span className="block text-s text-text-muted">Nyeste revy</span>
                    <span className="block text-xl font-semibold">{currentRevue.name} ({currentRevue.year})</span>
                </SiteLink>
            )}
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
            {earlierRevues.length > 0 && (
                <section className="mt-8">
                    <h2>Tidligere revyer</h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mt-4">
                        {earlierRevues.map(revue => (
                            <ImageCard
                                key={revue.id}
                                href={revueLinks.revue(revue)}
                                image={revue.article.coverImage.image}
                                title={revue.name}
                            >
                                <p>{revue.year}</p>
                            </ImageCard>
                        ))}
                    </div>
                </section>
            )}
            <CreateRevue />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
