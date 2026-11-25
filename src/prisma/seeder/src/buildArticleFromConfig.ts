import { getImageForCmsImageRelation } from '@/seeder/src/standardContent/seedImages'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import type { ImagesAvailablieForCms } from '@/seeder/src/standardContent/seedImages'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { Data } from '@/services/serviceOperation'
import type { UpdateArticleOperations } from '@/services/cms/articles/implement'

export const CMS_PARAGRAPHS_DIR = fileURLToPath(new URL('../cms_paragraphs/', import.meta.url))

type SeedCmsImageConfig = { image: ImagesAvailablieForCms }

type SeedCmsParagraphConfig = {
    file: string,
}

type SeedCmsLinkConfig =
    Required<Data<UpdateArticleOperations['articleSections']['cmsLink']>>

export type SeedArticleSectionConfig = {
    cmsParagraph?: SeedCmsParagraphConfig,
    cmsImage?: SeedCmsImageConfig,
    cmsLink?: SeedCmsLinkConfig,
}

export type SeedArticleConfig = Required<Data<UpdateArticleOperations['update']>> & {
    coverImage: SeedCmsImageConfig,
    articleSections: SeedArticleSectionConfig[],
}

/**
 * Builds out an already-created (but still empty) article's content - name, cover image, and
 * sections - the same way the admin CMS editor would. Each domain (article categories, news, ...)
 * owns articles differently (a category groups them; a news article wraps one directly), so
 * rather than injecting a whole article operations object generically - which the type
 * system can't verify calls against once its implementation params schema is still a naked
 * generic - the caller injects one already-bound function per operation, closing over its own
 * implementationParams/params.
 */
export async function buildArticleFromConfig(
    {
        updateName,
        updateCoverImage,
        addSection,
        updateSectionParagraph,
        updateSectionImage,
        updateSectionLink,
        article,
        prisma,
    }: {
        updateName: (
            data: Data<UpdateArticleOperations['update']>
        ) => Promise<unknown>,
        updateCoverImage: (
            data: Data<UpdateArticleOperations['coverImage']>
        ) => Promise<unknown>,
        addSection: (
            data: Data<UpdateArticleOperations['addSection']>
        ) => ReturnType<UpdateArticleOperations['addSection']>,
        updateSectionParagraph: (
            paragraphId: number,
            data: Data<UpdateArticleOperations['articleSections']['cmsParagraph']>
        ) => Promise<unknown>,
        updateSectionImage: (
            cmsImageId: number,
            data: Data<UpdateArticleOperations['articleSections']['cmsImage']>
        ) => Promise<unknown>,
        updateSectionLink: (
            linkId: number,
            data: Data<UpdateArticleOperations['articleSections']['cmsLink']>
        ) => Promise<unknown>,
        article: SeedArticleConfig,
        prisma: PrismaClient,
    }
) {
    await updateName({ name: article.name })

    const coverImage = await getImageForCmsImageRelation(article.coverImage.image, prisma)
    await updateCoverImage({ imageId: coverImage.id })

    // Sections are added one at a time rather than with Promise.all: addSection reads the
    // article's current highest section order and writes order + 1, so adding two sections
    // concurrently would race on that read-then-write and can violate the (articleId, order)
    // unique constraint.
    for (const section of article.articleSections) {
        const updatedArticle = await addSection({
            includeParts: {
                cmsParagraph: Boolean(section.cmsParagraph),
                cmsImage: Boolean(section.cmsImage),
                cmsLink: Boolean(section.cmsLink),
            }
        })

        // addSection always assigns the new section the current highest order + 1, so it's
        // always the section with the highest order in the returned article.
        const newSection = updatedArticle.articleSections.reduce(
            (highestOrderSection, candidateSection) => (
                candidateSection.order > highestOrderSection.order ? candidateSection : highestOrderSection
            )
        )

        if (section.cmsParagraph && newSection.cmsParagraph) {
            await updateSectionParagraph(newSection.cmsParagraph.id, {
                markdown: readFileSync(join(CMS_PARAGRAPHS_DIR, section.cmsParagraph.file), 'utf-8')
            })
        }

        if (section.cmsImage && newSection.cmsImage) {
            const sectionImage = await getImageForCmsImageRelation(section.cmsImage.image, prisma)
            await updateSectionImage(newSection.cmsImage.id, {
                imageId: sectionImage.id,
            })
        }

        if (section.cmsLink && newSection.cmsLink) {
            await updateSectionLink(newSection.cmsLink.id, {
                url: section.cmsLink.url,
                text: section.cmsLink.text
            })
        }
    }
}
