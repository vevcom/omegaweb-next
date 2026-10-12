import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { owIdToPnId } from './IdMapper'
import { createProgressBar } from './progressBar'
import logger from '@/lib/logger'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { Prisma as OwPrisma } from '@/prisma-generated-ow-basic/client'
import type { UserMigrator } from './migrateUsers'
import type { IdMapper } from './IdMapper'
import type { Limits } from './migrationLimits'

type OwArticle = OwPrisma.ArticlesGetPayload<object>

/**
 * CmsImage.name is globally unique, so the cover image of a migrated news article doubles
 * as the marker saying "Omegaweb-basic article N is already here". NewsArticle's own id
 * cannot be used for that: seedNews creates standard news articles before DobbelOmega
 * runs, so writing Omegaweb-basic ids into that table would collide with them.
 */
function coverImageName(article: OwArticle): string {
    return `ow_article_${article.id}_cover`
}

/**
 * Omegaweb-basic's displayTo decides who was allowed to read an article. Carrying it over
 * matters: everything migrated here is published, and a published news article with an
 * empty visibility is readable by the whole internet, so an article that used to be
 * members-only would be leaked by importing it naively.
 *
 * - all  -> no requirements, i.e. everyone
 * - user -> active member of Omega
 * - com  -> active member of the committee that wrote it, falling back to members-only
 *           if that committee has no migrated group
 */
function visibilityCreateInput(
    article: OwArticle,
    memberGroupId: number,
    committeeGroupIdMap: IdMapper,
    currentOrder: number,
) {
    if (article.displayTo === null || article.displayTo === 'all') return { create: {} }

    const committeeGroupId = article.displayTo === 'com'
        ? owIdToPnId(committeeGroupIdMap, article.AuthorCommitteeId, 'committees')
        : null

    if (article.displayTo === 'com' && committeeGroupId === null) {
        logger.warn(
            `Article "${article.title}" was committee-only, but committee ${article.AuthorCommitteeId} `
            + 'has no migrated group. Restricting it to members instead of publishing it openly.'
        )
    }

    return {
        create: {
            requirements: {
                create: [{
                    conditions: {
                        create: [{
                            groupId: committeeGroupId ?? memberGroupId,
                            type: 'ACTIVE' as const,
                            order: currentOrder,
                        }]
                    }
                }]
            }
        }
    }
}

/**
 * WARNING: The text formatting is still bad, and needs to be fixed. Omegaweb-basic stored
 * article bodies as html, so they are written straight to contentHtml and contentMd is
 * left empty - editing a migrated article in the CMS therefore starts from a blank
 * markdown source.
 *
 * Migrates Omegaweb-basic Articles to PN NewsArticles (each wrapping an Article with a
 * cover image and one body section). The old lead becomes the news article's description,
 * which is what the news list renders on each card, and the old text becomes the single
 * article section.
 *
 * InfoPages are deliberately not migrated. They were reviewed one by one and the outcome
 * was that almost none of them should come across as-is:
 *  * forside, for bedrifter, hytte: rewritten in the seeder instead
 *  * guider, om omega: seeded as standard article categories
 *  * interessegrupper, omegafond, jobbannonser: junk or replaced by real PN features
 *  * komiteer: migrateCommittees covers this
 * What is left is two conflicting prikkreglement and one notice with a broken image, so
 * the remainder is copied over by hand rather than by script.
 *
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @param idMaps - the ow -> pn id maps this step needs: images for cover images, and
 * committee groups for committee-only articles
 * @param userMigrator - used for the Omega members group that members-only articles are gated on
 * @param limits - Limits - used to limit the number of articles to migrate
 */
export default async function migrateNews(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    idMaps: { images: IdMapper, committeeGroups: IdMapper },
    userMigrator: UserMigrator,
    limits: Limits,
) {
    const allArticles = await owPrisma.articles.findMany({ take: limits.articles ? limits.articles : undefined })

    const alreadyMigrated = new Set((await pnPrisma.cmsImage.findMany({
        where: { name: { in: allArticles.map(coverImageName) } },
        select: { name: true },
    })).map(cmsImage => cmsImage.name))

    const articles = allArticles.filter(article => !alreadyMigrated.has(coverImageName(article)))

    const memberGroupId = userMigrator.getMemberGroupId()
    const { order: currentOrder } = await pnPrisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })

    const bar = createProgressBar('Migrating news', articles.length)
    for (const article of articles) {
        const coverId = owIdToPnId(idMaps.images, article.ImageId, 'images') || undefined

        await pnPrisma.newsArticle.create({
            data: {
                description: article.lead,
                endDateTime: article.dateEnd,
                // Omegaweb-basic had no draft state - every row in Articles was live on the
                // old site. Left unpublished these would all be admin-only, so the whole
                // archive would silently vanish from the new site.
                published: true,
                article: {
                    create: {
                        name: article.title,
                        createdAt: article.createdAt,
                        updatedAt: article.updatedAt,
                        coverImage: {
                            create: {
                                name: coverImageName(article),
                                image: coverId ? { connect: { id: coverId } } : undefined,
                            }
                        },
                        articleSections: {
                            create: [{
                                name: `ow_article_${article.id}_body`,
                                cmsParagraph: {
                                    create: {
                                        contentHtml: sanitizeHtml(article.text || ''),
                                        createdAt: article.createdAt,
                                        updatedAt: article.updatedAt,
                                    }
                                }
                            }]
                        },
                    }
                },
                visibilityRegular: visibilityCreateInput(
                    article, memberGroupId, idMaps.committeeGroups, currentOrder
                ),
                visibilityAdmin: { create: { requirements: { create: [{}] } } },
            }
        })

        bar.increment()
    }
    bar.stop()
}
