import { articleOperations } from './operations'
import { articleSchemas } from './schemas'
import { implementUpdateArticleSectionOperations } from '@/cms/articleSections/implement'
import { cmsImageOperations } from '@/cms/images/operations'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { z } from 'zod'
import type { ArgsAuthGetterAndOwnershipCheck, PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { Prisma, SpecialCmsArticle } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'

type ParamsSchema = typeof articleSchemas.params.update
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
type OwnerArgs<ImplementationParamsSchema extends z.ZodTypeAny> = {
    prisma: PrismaPossibleTransaction<false>,
    implementationParams: z.infer<ImplementationParamsSchema>,
}

type UpdateConfig<ImplementationParamsSchema extends z.ZodTypeAny> = {
    implementationParamsSchema: ImplementationParamsSchema,
    authorizer: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
    ownedArticles: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<OwnedArticle[]>,
    /**
     * Runs after authorization and before any of these operations. It lets the owner refuse the
     * whole set at once - a pensioned group, say, whose content may no longer be edited.
     */
    beforeRun?: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<void>,
}

/** Everything a user changes in an article: its name, cover, sections and the cms parts of those. */
function implementUpdateArticleOperations<
    const ImplementationParamsSchema extends z.ZodTypeAny
>({
    implementationParamsSchema,
    authorizer,
    ownedArticles,
    beforeRun,
}: UpdateConfig<ImplementationParamsSchema>) {
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

export type UpdateArticleOperations = ReturnType<typeof implementUpdateArticleOperations<z.ZodTypeAny>>

/**
 * The operations of the articles a service owns. The owner creates an article in the transaction
 * that writes its own row and destroys it after that row, both through `internal`.
 */
export function implementArticleOperations<
    const ImplementationParamsSchema extends z.ZodTypeAny
>({ maxNameLength, ...updateConfig }: UpdateConfig<ImplementationParamsSchema> & {
    maxNameLength: number,
}) {
    return {
        internal: {
            create: defineSubOperation({
                dataSchema: () => articleSchemas.data.create({ maxNameLength }),
                operation: () => ({ data }) => articleOperations.create.internalCall({
                    data,
                    dataSchemaImplementationFields: { maxNameLength },
                    operationImplementationFields: { special: null },
                }),
            }),
            update: articleOperations.update,
            destroy: articleOperations.destroy,
        },
        ...implementUpdateArticleOperations(updateConfig),
    } as const
}

/**
 * The operations of the one special article a service owns. `special` is the ownership check, so
 * the owner never writes one: `read` takes no params, and the update operations only reach the
 * article of that special. The article is created empty when first read.
 */
export function implementSpecialArticle({ special, authorizers }: {
    special: SpecialCmsArticle,
    authorizers: {
        read: Authorizer,
        update: Authorizer,
    },
}) {
    const read = defineSubOperation({
        operation: () => () => articleOperations.readSpecial.internalCall({ params: { special } }),
    })

    return {
        special,

        internal: {
            read,
        },

        read: defineOperation({
            authorizer: () => authorizers.read,
            operation: () => read.internalCall({}),
        }),

        update: implementUpdateArticleOperations({
            implementationParamsSchema: z.undefined(),
            authorizer: () => authorizers.update,
            ownedArticles: async () => [await read.internalCall({})],
        }),
    } as const
}
