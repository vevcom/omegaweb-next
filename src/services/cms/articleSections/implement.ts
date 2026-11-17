import '@pn-server-only'
import { articleSectionOperations } from './operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import type { articleSectionSchemas } from './schemas'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { z } from 'zod'
import type { ArgsAuthGetterAndOwnershipCheck, PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Awaitable } from '@/lib/awaitable'

type ParamsSchema = typeof articleSectionSchemas.params.addPart
type OwnedArticleSection = Prisma.ArticleSectionGetPayload<{
    include: {
        cmsImage: true,
        cmsParagraph: true,
        cmsLink: true,
    }
}>
type OwnerArgs<ImplementationParamsSchema extends z.ZodTypeAny> = {
    prisma: PrismaPossibleTransaction<false>,
    implementationParams: z.infer<ImplementationParamsSchema>,
}

type UpdateConfig<ImplementationParamsSchema extends z.ZodTypeAny> = {
    implementationParamsSchema: ImplementationParamsSchema,
    authorizer: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<Authorizer>,
    ownedArticleSections: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<OwnedArticleSection[]>,
    /**
     * Runs after authorization and before any of these operations. It lets the owner refuse the
     * whole set at once - a pensioned group, say, whose content may no longer be edited.
     */
    beforeRun?: (args: OwnerArgs<ImplementationParamsSchema>) => Awaitable<void>,
}

/**
 * The operations of the article sections a service owns outside any article. The owner creates a
 * section in the transaction that writes its own row and destroys it after that row, both through
 * `internal`. Such a section stays when its last part is removed.
 */
export function implementArticleSectionOperations<
    const ImplementationParamsSchema extends z.ZodTypeAny
>(config: UpdateConfig<ImplementationParamsSchema>) {
    return {
        internal: {
            create: articleSectionOperations.create,
            destroy: articleSectionOperations.destroy,
        },
        ...implementUpdateArticleSectionOperations({ ...config, destroyOnEmpty: false }),
    } as const
}

/** Everything a user changes in an article section: its text, and the cms parts it holds. */
export function implementUpdateArticleSectionOperations<
    const ImplementationParamsSchema extends z.ZodTypeAny
>({
    implementationParamsSchema,
    authorizer,
    ownedArticleSections,
    beforeRun,
    destroyOnEmpty
}: UpdateConfig<ImplementationParamsSchema> & {
    destroyOnEmpty: boolean,
}) {
    const ownershipCheckArticleSection = async (
        args: Omit<ArgsAuthGetterAndOwnershipCheck<false, ParamsSchema, undefined, ImplementationParamsSchema>, 'data'>
    ) => {
        const ownedArticleSectionsComputed = await ownedArticleSections(args)
        const ownedIds = ownedArticleSectionsComputed.map(section => section.id)
        const ownedNames = ownedArticleSectionsComputed.map(section => section.name)
        if (args.params.articleSectionId) return ownedIds.includes(args.params.articleSectionId)
        if (args.params.articleSectionName) return ownedNames.includes(args.params.articleSectionName)
        return false //This should never happen
    }

    const getOwnedIds = async (args: OwnerArgs<ImplementationParamsSchema>) => {
        const ownedArticleSectionsComputed = await ownedArticleSections(args)
        return {
            paragraphIds: ownedArticleSectionsComputed.map(
                section => section.cmsParagraph?.id).filter(id => id !== undefined),
            cmsImageIds: ownedArticleSectionsComputed.map(section => section.cmsImage?.id).filter(id => id !== undefined),
            linkIds: ownedArticleSectionsComputed.map(section => section.cmsLink?.id).filter(id => id !== undefined),
        }
    }

    return {
        update: articleSectionOperations.update.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: ownershipCheckArticleSection,
        }),
        addPart: articleSectionOperations.addPart.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: ownershipCheckArticleSection,
        }),
        removePart: articleSectionOperations.removePart.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: ownershipCheckArticleSection,
            operationImplementationFields: { destroyOnEmpty }
        }),
        cmsParagraph: cmsParagraphOperations.updateContent.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: async (args) => {
                const { paragraphIds } = await getOwnedIds(args)
                return paragraphIds.includes(args.params.paragraphId)
            }
        }),
        cmsImage: cmsImageOperations.update.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: async (args) => {
                const { cmsImageIds } = await getOwnedIds(args)
                return cmsImageIds.includes(args.params.cmsImageId)
            }
        }),
        cmsLink: cmsLinkOperations.update.implement({
            implementationParamsSchema,
            authorizer,
            beforeRun,
            ownershipCheck: async (args) => {
                const { linkIds } = await getOwnedIds(args)
                return linkIds.includes(args.params.linkId)
            }
        })
    } as const
}

