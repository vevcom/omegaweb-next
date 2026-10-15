import RemovePart from './RemovePart'
import ImageControls from './ImageControls'
import AddPartToArticleSection from './AddPartToArticleSection'
import CmsLink from '@/cms/CmsLink/CmsLink'
import CmsImage from '@/cms/CmsImage/CmsImage'
import CmsParagraph from '@/cms/CmsParagraph/CmsParagraph'
import { configureAction } from '@/services/configureAction'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import type {
    ExpandedArticleSection,
    AddPartToArticleSectionAction,
    RemovePartFromArticleSectionAction,
    UpdateArticleSectionAction
} from '@/cms/articleSections/types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'
import type { UpdateCmsImageAction } from '@/cms/images/types'
import type { UpdateCmsLinkAction } from '@/cms/links/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    articleSection: ExpandedArticleSection
    actions: {
        updateCmsParagraph: UpdateCmsParagraphAction,
        updateCmsImage: UpdateCmsImageAction,
        updateCmsLink: UpdateCmsLinkAction,
        updateArticleSection: UpdateArticleSectionAction,
        addPartToArticleSection: AddPartToArticleSectionAction,
        removePartFromArticleSection: RemovePartFromArticleSectionAction
    }
    capabilities: Capabilities<'canEdit'>
}

export type ArticleSectionActions = PropTypes['actions']

// A part's remove button sits on its top right corner, above the part itself.
const removerClassName = 'absolute -top-[10px] -right-[10px] z-2'

const imageClassName = [
    'relative isolate max-w-full',
    // .cmsImageWithControls is absolutely positioned, so on mobile the image needs its own height.
    'max-mobile:order-2 max-mobile:rounded-round max-mobile:h-[min(300px,40vh)]',
].join(' ')

// The image is pinned to the box via absolute positioning rather than a chain of percentage
// heights through CmsImage's display:table, which made the whole row balloon. CmsImage's own
// wrapper divs size off the image's intrinsic width, so they are forced to fill it at any depth.
const cmsImageWithControlsClassName = [
    'absolute inset-0 flex overflow-hidden z-1',
    '[&>*:first-child]:absolute [&>*:first-child]:inset-0 [&>*:first-child]:w-full [&>*:first-child]:h-full',
    '[&>*:first-child]:rounded-round [&>*:first-child]:overflow-hidden [&>*:first-child]:max-w-[90vw]',
    '[&>*:first-child>*]:min-w-full [&>*:first-child>*]:max-w-[83vw]',
    '[&>*:first-child_div]:absolute [&>*:first-child_div]:inset-0 [&>*:first-child_div]:w-full [&>*:first-child_div]:h-full',
    '[&>*:first-child_img]:absolute [&>*:first-child_img]:inset-0 [&>*:first-child_img]:w-full',
    '[&>*:first-child_img]:h-full [&>*:first-child_img]:object-cover',
].join(' ')

export default function ArticleSection({
    articleSection,
    actions,
    capabilities,
}: PropTypes) {
    const { cmsParagraph, cmsImage, cmsLink } = articleSection
    const clientCapabilities = capabilitiesToJsObject(capabilities)

    const cmsImageContent = (
        // cmsImageWithControls fills this box via absolute positioning (see its classes),
        // so it no longer contributes in-flow content .image could size its own width from -
        // give it the configured image width explicitly instead.
        <span className={imageClassName} style={{ width: articleSection.imageSize }}>
            {cmsImage && <>
                <span className={cmsImageWithControlsClassName}>
                    <CmsImage
                        width={articleSection.imageSize}
                        cmsImage={cmsImage}
                        updateCmsImageAction={actions.updateCmsImage}
                        capabilities={capabilities}
                    />
                    <ImageControls
                        className="absolute top-0 left-0 w-full h-full translate-y-full max-mobile:hidden"
                        articleSection={articleSection}
                        updateArticleSectionAction={actions.updateArticleSection}
                        capabilities={clientCapabilities}
                    />
                </span>
                <div className={removerClassName}>
                    <RemovePart
                        part="cmsImage"
                        removePartFromArticleSectionAction={
                            configureAction(
                                actions.removePartFromArticleSection,
                                { params: { articleSectionName: articleSection.name } }
                            )
                        }
                        capabilities={clientCapabilities}
                    />
                </div>
            </>
            }
        </span>
    )

    return (
        <section className="isolate grid grid-cols-[minmax(0,1fr)]">
            <AddPartToArticleSection
                showParagraphAdd={!cmsParagraph}
                showImageAdd={!cmsImage}
                showLinkAdd={!cmsLink}
                addPartToArticleSectionAction={configureAction(
                    actions.addPartToArticleSection,
                    { params: { articleSectionName: articleSection.name } }
                )}
                capabilities={clientCapabilities}
            >
                <span
                    className={[
                        'flex flex-row flex-wrap gap-4 max-mobile:flex-col max-mobile:flex-nowrap',
                        // Lets a part's remove confirmation lie on top of the part beside it.
                        '[&>*:first-child]:z-2 [&>*:nth-child(2)]:z-1',
                    ].join(' ')}
                >
                    {
                        cmsImage && articleSection.imagePosition === 'LEFT' &&
                        cmsImageContent
                    }
                    <div className="min-h-full min-w-0 flex-1 flex flex-col mb-2 max-mobile:min-h-auto max-mobile:order-1">
                        {
                            cmsParagraph &&
                        <span className="relative isolate flex-[1_1_100%] max-mobile:mr-2">
                            <div className={removerClassName}>
                                <RemovePart
                                    part="cmsParagraph"
                                    removePartFromArticleSectionAction={
                                        configureAction(
                                            actions.removePartFromArticleSection,
                                            { params: { articleSectionName: articleSection.name } }
                                        )
                                    }
                                    capabilities={clientCapabilities}
                                />
                            </div>
                            <CmsParagraph
                                cmsParagraph={cmsParagraph}
                                className="z-1"
                                updateCmsParagraphAction={actions.updateCmsParagraph}
                                capabilities={capabilities}
                            />
                        </span>
                        }
                        {
                            cmsLink &&
                        <div className="relative isolate mt-2 max-w-[200px]">
                            <div className={removerClassName}>
                                <RemovePart
                                    part="cmsLink"
                                    removePartFromArticleSectionAction={
                                        configureAction(
                                            actions.removePartFromArticleSection,
                                            { params: { articleSectionName: articleSection.name } }
                                        )
                                    }
                                    capabilities={clientCapabilities}
                                />
                            </div>
                            <CmsLink
                                className="z-1"
                                capabilities={capabilities}
                                cmsLink={cmsLink}
                                updateCmsLinkAction={actions.updateCmsLink}
                            />
                        </div>
                        }
                    </div>
                    {
                        cmsImage && articleSection.imagePosition === 'RIGHT' &&
                        cmsImageContent
                    }
                </span>
            </AddPartToArticleSection>
        </section>
    )
}
