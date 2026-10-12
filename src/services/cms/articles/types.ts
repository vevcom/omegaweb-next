import type { Prisma } from '@/prisma-generated-pn-types'
import type { articleRelationsIncluder } from './constants'
import type { ActionFromServiceOperation, ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { articleOperations } from './operations'
import type { implementSpecialArticle } from './implement'

export type ExpandedArticle = Prisma.ArticleGetPayload<{
    include: typeof articleRelationsIncluder
}>

export type UpdateArticleAction = ActionFromSubServiceOperation<typeof articleOperations.update>
export type AddSectionToArticleAction = ActionFromSubServiceOperation<typeof articleOperations.addSection>
export type ReorderArticleSectionsAction = ActionFromSubServiceOperation<typeof articleOperations.reorderSections>

type SpecialArticleUpdateOperations = ReturnType<typeof implementSpecialArticle>['update']

/**
 * The actions a service exposes for the one special article it owns. Every special article goes
 * through implementSpecialArticle, so they all share this shape - which is what lets a single
 * SpecialArticle component render any of them from whichever service owns it.
 */
export type SpecialArticleActions = {
    update: ActionFromServiceOperation<SpecialArticleUpdateOperations['update']>,
    addSection: ActionFromServiceOperation<SpecialArticleUpdateOperations['addSection']>,
    reorderSections: ActionFromServiceOperation<SpecialArticleUpdateOperations['reorderSections']>,
    coverImage: ActionFromServiceOperation<SpecialArticleUpdateOperations['coverImage']>,
    articleSections: {
        update: ActionFromServiceOperation<SpecialArticleUpdateOperations['articleSections']['update']>,
        addPart: ActionFromServiceOperation<SpecialArticleUpdateOperations['articleSections']['addPart']>,
        removePart: ActionFromServiceOperation<SpecialArticleUpdateOperations['articleSections']['removePart']>,
        cmsImage: ActionFromServiceOperation<SpecialArticleUpdateOperations['articleSections']['cmsImage']>,
        cmsParagraph: ActionFromServiceOperation<SpecialArticleUpdateOperations['articleSections']['cmsParagraph']>,
        cmsLink: ActionFromServiceOperation<SpecialArticleUpdateOperations['articleSections']['cmsLink']>,
    },
}
