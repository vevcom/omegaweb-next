import '@pn-server-only'
import { committeeAuth } from './auth'
import { committeeExpandedIncluder, committeeLogoIncluder } from './constants'
import { committeeSchemas } from './schemas'
import { committeeLogoImageOperations } from './committeeLogoCollection'
import { groupOperations } from '@/services/groups/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { defineOperation } from '@/services/serviceOperation'
import {
    implementGroupType,
    implementManualMigrationPerGroup,
    implementSimpleAddRemoveMembersOperation,
} from '@/services/groups/implementGroupType'
import { articleRelationsIncluder } from '@/cms/articles/constants'
import { implementUpdateArticleOperations } from '@/cms/articles/implement'
import { articleOperations } from '@/cms/articles/operations'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { assertGroupNotPensioned } from '@/services/groups/groupChecks'
import { GroupType } from '@/prisma-generated-pn-types'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Prisma } from '@/prisma-generated-pn-types'

const readAll = defineOperation({
    authorizer: () => committeeAuth.readAll,
    operation: async ({ prisma }) => {
        const defaultCommitteeLogo = await readDefaultCommitteeLogo()

        const committees = await prisma.committee.findMany({
            include: committeeLogoIncluder,
        })

        return committees.map(committee => ({
            ...committee,
            logoImage: committee.logoImage ?? defaultCommitteeLogo
        }))
    }
})

const read = defineOperation({
    authorizer: () => committeeAuth.read,
    paramsSchema: committeeSchemas.params.read,
    operation: async ({ prisma, params }) => {
        const defaultCommitteeLogo = await readDefaultCommitteeLogo()

        const result = await prisma.committee.findUniqueOrThrow({
            where: params,
            include: committeeExpandedIncluder,
        })

        return {
            ...result,
            logoImage: result.logoImage ?? defaultCommitteeLogo,
            coverImage: result.committeeArticle.coverImage,
        }
    }
})

const readArticle = defineOperation({
    authorizer: () => committeeAuth.readArticle,
    paramsSchema: committeeSchemas.params.readArticle,
    operation: async ({ prisma, params }) => (await prisma.committee.findUniqueOrThrow({
        where: params,
        select: {
            committeeArticle: {
                include: articleRelationsIncluder,
            }
        }
    })).committeeArticle
})

const readParagraph = defineOperation({
    authorizer: () => committeeAuth.readParagraph,
    paramsSchema: committeeSchemas.params.readParagraph,
    operation: async ({ prisma, params }) => (await prisma.committee.findUniqueOrThrow({
        where: params,
        select: {
            paragraph: true,
        }
    })).paragraph
})

/** The group behind a committee, for the authorizers and the pensioned check, without the rest of it. */

const updateParagraphContent = cmsParagraphOperations.updateContent.implement({
    implementationParamsSchema: committeeSchemas.params.updateParagraphContent,
    authorizer: async ({ implementationParams, prisma }) =>
        committeeAuth.updateParagraphContent.data({
            groupId: await readGroupIdOfCommittee(prisma, { shortName: implementationParams.shortName }),
        }),
    ownershipCheck: async ({ implementationParams, params }) =>
        (await readParagraph({
            params: { shortName: implementationParams.shortName },
            bypassAuth: true
        })).id === params.paragraphId,
    beforeRun: async ({ prisma, implementationParams }) => assertGroupNotPensioned(
        prisma,
        await readGroupIdOfCommittee(prisma, { shortName: implementationParams.shortName }),
    ),
})

const updateLogo = defineOperation({
    authorizer: async ({ params, prisma }) =>
        committeeAuth.updateLogo.data({
            groupId: await readGroupIdOfCommittee(prisma, { shortName: params.shortName }),
        }),
    paramsSchema: committeeSchemas.params.updateLogo,
    dataSchema: committeeSchemas.data.updateLogo,
    opensTransaction: true,
    operation: async ({ prisma, params, data }) => {
        await assertGroupNotPensioned(prisma, await readGroupIdOfCommittee(prisma, { shortName: params.shortName }))

        const { image: newImage, cleanup } = await prisma.$transaction(async tx => {
            const existingCommittee = await tx.committee.findUniqueOrThrow({
                where: { shortName: params.shortName },
            })

            const uploadedImage =
                await committeeLogoImageOperations.uploadImage.internalCall({ prisma: tx, data })

            await tx.committee.update({
                where: { id: existingCommittee.id },
                data: {
                    logoImage: {
                        connect: { id: uploadedImage.id }
                    }
                }
            })

            // A previous logoImageId is always an upload owned 1:1 by this committee (never the
            // shared default, since that's only ever resolved at read time) - safe to destroy.
            const fileCleanup = existingCommittee.logoImageId
                ? await committeeLogoImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                    prisma: tx,
                    params: { imageId: existingCommittee.logoImageId }
                })
                : async () => {}

            return { image: uploadedImage, cleanup: fileCleanup }
        })
        await cleanup()
        return newImage
    }
})

const destroy = defineOperation({
    authorizer: () => committeeAuth.destroy,
    paramsSchema: committeeSchemas.params.destroy,
    opensTransaction: true,
    operation: async ({ prisma, params }) => {
        await assertGroupNotPensioned(prisma, await readGroupIdOfCommittee(prisma, { id: params.id }))

        // Everything the committee owns goes in one transaction. Only the logo's file waits until
        // the transaction has committed, since a file cannot be rolled back.
        const { committee, cleanupLogo } = await prisma.$transaction(async tx => {
            const deleted = await tx.committee.delete({
                where: {
                    id: params.id,
                },
            })
            await cmsParagraphOperations.destroy.internalCall({
                prisma: tx,
                params: { paragraphId: deleted.paragraphId },
            })
            await articleOperations.destroy.internalCall({
                prisma: tx,
                params: { articleId: deleted.committeeArticleId },
            })
            const logoCleanup = deleted.logoImageId
                ? await committeeLogoImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                    prisma: tx,
                    params: { imageId: deleted.logoImageId },
                })
                : async () => {}
            await groupOperations.destroy.internalCall({
                prisma: tx,
                params: { groupId: deleted.groupId },
            })
            return { committee: deleted, cleanupLogo: logoCleanup }
        })
        await cleanupLogo()

        return committee
    }
})

const create = defineOperation({
    authorizer: () => committeeAuth.create,
    dataSchema: committeeSchemas.data.create,
    opensTransaction: true,
    operation: ({ prisma, data }) =>
        prisma.$transaction(async tx => {
            const logoImage = data.imageFile
                ? await committeeLogoImageOperations.uploadImage.internalCall({
                    prisma: tx,
                    data: {
                        imageFile: data.imageFile,
                        imageAlt: data.imageAlt || `Komitélogoen til ${data.name}`,
                        imageName: data.imageName,
                        imageLicenseId: data.imageLicenseId,
                        imageCredit: data.imageCredit,
                    }
                })
                : null

            const article = await articleOperations.create.internalCall({
                prisma: tx,
                data: {},
                dataSchemaImplementationFields: { maxNameLength: 30 },
                operationImplementationFields: { special: null }
            })

            const paragraph = await cmsParagraphOperations.create.internalCall({
                prisma: tx,
                data: { name: `Paragraph for ${data.name}` },
                operationImplementationFields: { special: null }
            })

            const order = (await omegaOrderOperations.readCurrent({ bypassAuth: true })).order

            return await tx.committee.create({
                data: {
                    name: data.name,
                    shortName: data.shortName,
                    logoImage: logoImage ? {
                        connect: {
                            id: logoImage.id,
                        },
                    } : undefined,
                    paragraph: {
                        connect: {
                            id: paragraph.id,
                        }
                    },
                    group: {
                        create: {
                            groupType: GroupType.COMMITTEE,
                            order,
                        }
                    },
                    committeeArticle: {
                        connect: {
                            id: article.id
                        }
                    }
                },
                include: {
                    logoImage: { include: expandedImageIncluder },
                },
            })
        })
})

const update = defineOperation({
    authorizer: () => committeeAuth.update,
    paramsSchema: committeeSchemas.params.update,
    dataSchema: committeeSchemas.data.update,
    operation: async ({ prisma, params, data }) => {
        await assertGroupNotPensioned(prisma, await readGroupIdOfCommittee(prisma, { id: params.id }))
        const defaultCommitteeLogo = await readDefaultCommitteeLogo()

        const committee = await prisma.committee.update({
            where: {
                id: params.id,
            },
            data,
            include: {
                logoImage: { include: expandedImageIncluder },
            },
        })

        return {
            ...committee,
            logoImage: committee.logoImage ?? defaultCommitteeLogo
        }
    }
})

const updateArticle = implementUpdateArticleOperations({
    authorizer: async ({ implementationParams, prisma }) => committeeAuth.updateArticle.data({
        groupId: await readGroupIdOfCommittee(prisma, { shortName: implementationParams.shortName }),
    }),
    implementationParamsSchema: committeeSchemas.params.updateArticle,
    ownedArticles: async ({ implementationParams }) => {
        const article = await readArticle({ params: { shortName: implementationParams.shortName }, bypassAuth: true })
        return [article]
    },
    beforeRun: async ({ prisma, implementationParams }) => assertGroupNotPensioned(
        prisma,
        await readGroupIdOfCommittee(prisma, { shortName: implementationParams.shortName }),
    ),
})

const commonGroupOperations = implementGroupType({
    type: GroupType.COMMITTEE,
    auth: {
        readExpanded: committeeAuth.readExpanded,
        readMembers: ({ groupId }) => committeeAuth.readMembers.data({ groupId }),
        readMembershipsOfUser: ({ userId }) => committeeAuth.readMembershipsOfUser.data({ userId }),
    },
})

const memberManagement = implementSimpleAddRemoveMembersOperation({
    type: GroupType.COMMITTEE,
    auth: {
        addMembers: ({ groupId }) => committeeAuth.addMembers.data({ groupId }),
        removeMembers: ({ groupId }) => committeeAuth.removeMembers.data({ groupId }),
        setMemberAdmin: ({ groupId }) => committeeAuth.setMemberAdmin.data({ groupId }),
        setMemberTitle: ({ groupId }) => committeeAuth.setMemberTitle.data({ groupId }),
    },
})

const migration = implementManualMigrationPerGroup({
    type: GroupType.COMMITTEE,
    auth: {
        migrateGroup: ({ groupId }) => committeeAuth.migrateGroup.data({ groupId }),
        pension: () => committeeAuth.pension,
    },
    setPensioned: (prisma, groupId, pensioned) => prisma.committee.update({
        where: { groupId },
        data: { pensioned },
    }),
})

export const committeeOperations = {
    create,
    update,
    updateLogo,
    readAll,
    read,
    readExpanded: commonGroupOperations.readExpanded,
    readMembers: commonGroupOperations.readMembers,
    readMembershipsOfUser: commonGroupOperations.readMembershipsOfUser,
    addMembers: memberManagement.addMembers,
    removeMembers: memberManagement.removeMembers,
    setMemberAdmin: memberManagement.setMemberAdmin,
    setMemberTitle: memberManagement.setMemberTitle,
    migrateGroup: migration.migrateGroup,
    pension: migration.pension,
    readArticle,
    readParagraph,
    updateParagraphContent,
    destroy,
    updateArticle,
} as const

async function readDefaultCommitteeLogo() {
    return standardImageCollectionOperations.readStandardImage({
        params: { standardImage: 'DEFAULT_COMMITTEE_LOGO' },
    })
}

async function readGroupIdOfCommittee(
    prisma: PrismaPossibleTransaction<false>,
    where: Prisma.CommitteeWhereUniqueInput,
) {
    return (await prisma.committee.findUniqueOrThrow({ where, select: { groupId: true } })).groupId
}
