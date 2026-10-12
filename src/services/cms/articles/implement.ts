import { articleOperations } from './operations'
import { implementUpdateArticleSectionOperations } from '@/cms/articleSections/implement'
import { cmsImageOperations } from '@/cms/images/operations'
import { defineOperation } from '@/services/serviceOperation'
import { z } from 'zod'
import type { ArgsAuthGetterAndOwnershipCheck, PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { Prisma, SpecialCmsArticle } from '@/prisma-generated-pn-types'
import type { articleSchemas } from './schemas'

type ParamsSchema = typeof articleSchemas.params
type OwnedArticle = Prisma.ArticleGetPayload<{
    include: {
        coverImage: true,
        articleSections: {
            include: {
                cmsImage: true,
                cmsParagraph: true,
                cmsLink: true,
            }
        }
    }
}>
/**
 * This utility implements all the needed operations for an article section and
 * the assosiated cms: CmsLink, CmsParagraph, CmsImage
 */
export function implementUpdateArticleOperations<
    const ImplementationParamsSchema extends z.ZodTypeAny
>({
    implementationParamsSchema,
    authorizer,
    ownedArticles,
    beforeRun,
}: {
    implementationParamsSchema: ImplementationParamsSchema,
    authorizer: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            implementationParams: z.infer<ImplementationParamsSchema>
        }
    ) => Authorizer | Promise<Authorizer>,
    ownedArticles: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            implementationParams: z.infer<ImplementationParamsSchema>
        }
    ) => Promise<OwnedArticle[]>
    /**
     * Runs after authorization and before any of these operations. It lets the owner refuse the
     * whole set at once - a pensioned group, say, whose content may no longer be edited.
     */
    beforeRun?: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            implementationParams: z.infer<ImplementationParamsSchema>
        }
    ) => void | Promise<void>,
}) {
    const ownershipCheckArticle = async (
        args: Omit<ArgsAuthGetterAndOwnershipCheck<false, ParamsSchema, undefined, ImplementationParamsSchema>, 'data'>
    ) => {
        const ownedArticleIds = (await ownedArticles(args)).map(article => article.id)
        return ownedArticleIds.includes(args.params.articleId)
    }

    return {
        update: articleOperations.update.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: ownershipCheckArticle
        }),
        addSection: articleOperations.addSection.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: ownershipCheckArticle
        }),
        reorderSections: articleOperations.reorderSections.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: ownershipCheckArticle
        }),
        coverImage: cmsImageOperations.update.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: async (args) => {
                const coverCmsImagesIds = (await ownedArticles(args)).map(article => article.coverImage.id)
                return coverCmsImagesIds.includes(args.params.cmsImageId)
            }
        }),
        articleSections: implementUpdateArticleSectionOperations({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownedArticleSections: async (args) => {
                const ownedArticlesComputed = await ownedArticles(args)
                const ownedArticleSections = ownedArticlesComputed.flatMap(article => article.articleSections)
                return ownedArticleSections
            },
            destroyOnEmpty: true,
        })
    } as const
}

/**
 * Implements the whole operation set - the read and every update operation - for a service that
 * owns exactly one article addressed by a fixed `special` enum value, rather than by id.
 *
 * The `special` passed in *is* the ownership check, which is why the owner never writes one: `read`
 * takes no params at all, so a caller cannot ask it for another service's special article, and the
 * update operations resolve their owned article from the same fixed value. Compare the alternative,
 * where every owner repeats two `implement` calls and hand-writes a check that its operations only
 * ever touch its own article - the kind of thing that is correct until someone adds a third special
 * article and copies the wrong constant into it.
 */
export function implementSpecialArticle({
    special,
    readAuthorizer,
    updateAuthorizer,
}: {
    special: SpecialCmsArticle,
    readAuthorizer: Authorizer,
    updateAuthorizer: Authorizer,
}) {
    /**
     * The unauthorized read of the article. It self-heals: readSpecial creates the article from
     * config if it is missing, so the update operations below always have exactly one owned article
     * to check against, even on a database that has never been seeded.
     */
    const readInternal = (
        { prisma }: { prisma: PrismaPossibleTransaction<false> }
    ) => articleOperations.readSpecial.internalCall({ params: { special }, prisma })

    return {
        read: defineOperation({
            authorizer: () => readAuthorizer,
            operation: async ({ prisma }) => readInternal({ prisma }),
        }),
        update: implementUpdateArticleOperations({
            implementationParamsSchema: z.undefined(),
            authorizer: () => updateAuthorizer,
            ownedArticles: async ({ prisma }) => [await readInternal({ prisma })],
        }),
    } as const
}
