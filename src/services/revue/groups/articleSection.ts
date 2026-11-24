import '@ow-server-only'
import { revueGroupAuth } from './auth'
import { revueGroupSchemas } from './schemas'
import { ServiceError } from '@/services/error'
import { implementArticleSectionOperations } from '@/cms/articleSections/implement'
import { articleSectionsRelationsIncluder } from '@/cms/articleSections/constants'

export const revueGroupArticleSection = implementArticleSectionOperations({
    implementationParamsSchema: revueGroupSchemas.params.articleSection,
    authorizer: async ({ prisma, implementationParams }) => {
        const { committee, revueSubGroup } = await prisma.revueGroup.findUniqueOrThrow({
            where: { id: implementationParams.revueGroupId },
            select: { committee: { select: { groupId: true } }, revueSubGroup: { select: { groupId: true } } },
        })
        const groupId = committee?.groupId ?? revueSubGroup?.groupId
        if (groupId === undefined) throw new ServiceError('SERVER ERROR', 'Revygruppen har verken komité eller undergruppe')
        return revueGroupAuth.updateArticleSection.data({ groupId })
    },
    ownedArticleSections: async ({ prisma, implementationParams }) => [
        (await prisma.revueGroup.findUniqueOrThrow({
            where: { id: implementationParams.revueGroupId },
            select: { articleSection: { include: articleSectionsRelationsIncluder } },
        })).articleSection,
    ],
})
