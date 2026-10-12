import { getImageForCmsImageRelation } from './seedImages'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import { articleOperations } from '@/cms/articles/operations'
import { newStudentOperations } from '@/services/newStudent/operations'
import { reportOperations } from '@/services/report/operations'
import { cabinArticleOperations } from '@/services/cabin/article/operations'
import { buildArticleFromConfig, CMS_PARAGRAPHS_DIR } from '@/seeder/src/buildArticleFromConfig'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import { SpecialCmsArticle, SpecialCmsImage, SpecialCmsLink, SpecialCmsParagraph } from '@/prisma-generated-pn/enums'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ImagesAvailablieForCms } from './seedImages'
import type { SeedArticleConfig, UpdateArticleOperationsReference } from '@/seeder/src/buildArticleFromConfig'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * This object describes the wanted initial configuration of special cms images.
 * Note of course that this is no guarantee the special cms image will contain this image forever
 * but it creates an initial state (i.e. image relation) that is nice for development.
 *
 * Strictly speaking it is not necessary to seed any special cms image, as the cms image api will
 * create the special cms image on runtime if it does not exist - but with a null image relation.
 */
const seedSpecialCmsImageConfig: Record<SpecialCmsImage, ImagesAvailablieForCms> = {
    FRONTPAGE_1: { dynamicImageSeededForCmsName: 'kappemann' },
    FRONTPAGE_2: { dynamicImageSeededForCmsName: 'ohma' },
    FRONTPAGE_3: { dynamicImageSeededForCmsName: 'ov' },
    FRONTPAGE_4: { dynamicImageSeededForCmsName: 'ohma' },
}

/**
 * Same idea as seedSpecialCmsImageConfig, but for special cms paragraphs: the file path is
 * resolved relative to CMS_PARAGRAPHS_DIR and read in as the paragraph's initial markdown content.
 */
const seedSpecialCmsParagraphConfig: Record<SpecialCmsParagraph, string> = {
    FRONTPAGE_1: 'frontpage/frontpage_1.md',
    FRONTPAGE_2: 'frontpage/frontpage_2.md',
    FRONTPAGE_3: 'frontpage/frontpage_3.md',
    FRONTPAGE_4: 'frontpage/frontpage_4.md',
    INTEREST_GROUP_GENERAL_INFO: 'interest_groups/general_info.md',
    CAREER_INFO: 'career/career_info.md',
    CABIN_CONTRACT: 'cabin/cabin_contract.md',
}

/**
 * Same idea as seedSpecialCmsImageConfig, but for special cms links.
 */
type SeedCmsLinkConfig = Required<Parameters<typeof cmsLinkOperations.update.internalCall>[0]['data']>

const seedSpecialCmsLinkConfig: Record<SpecialCmsLink, SeedCmsLinkConfig> = {
    CAREER_LINK_TO_CONTACTOR: {
        url: 'mailto:naeringsliv@omega.ntnu.no',
        text: 'Kontakt oss'
    },
}

/**
 * Every special article is owned by its own service - the one whose page renders it and whose
 * permissions guard it - so the seeding logic cannot reach for a single shared operations object.
 * Each entry names its owner's update operations instead.
 */
type SeedSpecialArticleConfig = SeedArticleConfig & {
    updateOperations: UpdateArticleOperationsReference,
}

const seedSpecialCmsArticleConfig: Record<SpecialCmsArticle, SeedSpecialArticleConfig> = {
    REPORT_PAGE: {
        updateOperations: reportOperations.update,
        name: 'Varslingside',
        coverImage: {
            image: { dynamicImageSeededForCmsName: 'ov' },
        },
        articleSections: [
            {
                cmsParagraph: {
                    file: 'varsling_info/varsling_info_1.md'
                }
            }
        ]
    },
    NEW_STUDENT_PAGE: {
        updateOperations: newStudentOperations.update,
        name: 'Ny Student',
        coverImage: {
            image: { dynamicImageSeededForCmsName: 'kappemann' },
        },
        articleSections: [
            {
                cmsParagraph: {
                    file: 'new_student/new_student_1.md'
                }
            }
        ]
    },
    CABIN_PAGE: {
        updateOperations: cabinArticleOperations.update,
        name: 'Hytta',
        coverImage: {
            image: { dynamicImageSeededForCmsName: 'ov' },
        },
        articleSections: [
            {
                cmsParagraph: {
                    file: 'cabin/cabin_page_1.md'
                }
            }
        ]
    },
}

/**
 * Seeds the special cms images, paragraphs, links and articles - the pieces of content addressed
 * by a fixed `special` enum value rather than by id (frontpage images and paragraphs, the career
 * contact link, and special articles like the report page). None of this is strictly necessary,
 * as every one of these self-heals with blank/placeholder content on first read if missing - this
 * just gives a nicer initial state for development.
 */
export const seedSpecialCms = defineSeedOperation(async prisma => {
    await Promise.all([
        ...Object.values(SpecialCmsImage).map(
            special => upsertSpecialCmsImage(prisma, special, seedSpecialCmsImageConfig[special])
        ),
        ...Object.values(SpecialCmsParagraph).map(
            special => upsertSpecialCmsParagraph(prisma, special, seedSpecialCmsParagraphConfig[special])
        ),
        ...Object.values(SpecialCmsLink).map(
            special => upsertSpecialCmsLink(prisma, special, seedSpecialCmsLinkConfig[special])
        ),
        ...Object.values(SpecialCmsArticle).map(
            special => upsertSpecialCmsArticle(prisma, special, seedSpecialCmsArticleConfig[special])
        ),
    ])
})

async function upsertSpecialCmsImage(
    prisma: PrismaClient,
    special: SpecialCmsImage,
    imageConfig: ImagesAvailablieForCms
) {
    return upsert({
        checkExistence: () => prisma.cmsImage.findUnique({
            where: { special },
            select: { id: true }
        }),
        create: async () => {
            const cmsImage = await cmsImageOperations.generateSpecialCmsImageFromConfig.internalCall({
                params: { special }
            })
            const image = await getImageForCmsImageRelation(imageConfig, prisma)
            return cmsImageOperations.update.internalCall({
                params: { cmsImageId: cmsImage.id },
                data: { imageId: image.id }
            })
        },
        update: () => Promise.resolve(),
    })
}

async function upsertSpecialCmsParagraph(
    prisma: PrismaClient,
    special: SpecialCmsParagraph,
    file: string
) {
    return upsert({
        checkExistence: () => prisma.cmsParagraph.findUnique({
            where: { special },
            select: { id: true }
        }),
        create: async () => {
            const paragraph = await cmsParagraphOperations.generateSpecialCmsParagraphFromConfig.internalCall({
                params: { special }
            })
            return cmsParagraphOperations.updateContent.internalCall({
                params: { paragraphId: paragraph.id },
                data: { markdown: readFileSync(join(CMS_PARAGRAPHS_DIR, file), 'utf-8') }
            })
        },
        update: () => Promise.resolve(),
    })
}

async function upsertSpecialCmsLink(
    prisma: PrismaClient,
    special: SpecialCmsLink,
    link: SeedCmsLinkConfig
) {
    return upsert({
        checkExistence: () => prisma.cmsLink.findUnique({
            where: { special },
            select: { id: true }
        }),
        create: async () => {
            const cmsLink = await cmsLinkOperations.generateSpecialCmsLinkFromConfig.internalCall({
                params: { special }
            })
            return cmsLinkOperations.update.internalCall({
                params: { linkId: cmsLink.id },
                data: link
            })
        },
        update: () => Promise.resolve(),
    })
}

async function upsertSpecialCmsArticle(
    prisma: PrismaClient,
    special: SpecialCmsArticle,
    article: SeedSpecialArticleConfig
) {
    return upsert({
        checkExistence: () => prisma.article.findUnique({
            where: { special },
            select: { id: true }
        }),
        create: () => createSpecialCmsArticle(prisma, special, article),
        update: () => Promise.resolve(),
    })
}

async function createSpecialCmsArticle(
    prisma: PrismaClient,
    special: SpecialCmsArticle,
    { updateOperations, ...article }: SeedSpecialArticleConfig
) {
    const createdArticle = await articleOperations.generateSpecialArticleFromConfig.internalCall({
        params: { special }
    })

    await buildArticleFromConfig({
        updateName: data => updateOperations.update({
            implementationParams: undefined,
            params: { articleId: createdArticle.id },
            data
        }),
        updateCoverImage: data => updateOperations.coverImage({
            implementationParams: undefined,
            params: { cmsImageId: createdArticle.coverImage.id },
            data
        }),
        addSection: data => updateOperations.addSection({
            implementationParams: undefined,
            params: { articleId: createdArticle.id },
            data
        }),
        updateSectionParagraph: (paragraphId, data) => updateOperations.articleSections.cmsParagraph({
            implementationParams: undefined,
            params: { paragraphId },
            data
        }),
        updateSectionImage: (cmsImageId, data) => updateOperations.articleSections.cmsImage({
            implementationParams: undefined,
            params: { cmsImageId },
            data
        }),
        updateSectionLink: (linkId, data) => updateOperations.articleSections.cmsLink({
            implementationParams: undefined,
            params: { linkId },
            data
        }),
        article,
        prisma,
    })

    return createdArticle
}
