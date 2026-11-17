import '@pn-server-only'
import { revueGroupAuth } from './auth'
import { revueGroupSchemas } from './schemas'
import { implementArticleSectionOperations } from '@/cms/articleSections/implement'
import { articleSectionsRelationsIncluder } from '@/cms/articleSections/constants'

export const revueGroupArticleSection = implementArticleSectionOperations({
    implementationParamsSchema: revueGroupSchemas.params.articleSection,
    authorizer: () => revueGroupAuth.updateArticleSection,
    ownedArticleSections: async ({ prisma, implementationParams }) => [
        (await prisma.revueGroup.findUniqueOrThrow({
            where: { id: implementationParams.groupId },
            select: { articleSection: { include: articleSectionsRelationsIncluder } },
        })).articleSection,
    ],
})
