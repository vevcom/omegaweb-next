import '@pn-server-only'
import { articleSectionSchemas } from './schemas'
import { articleSectionsRelationsIncluder } from './constants'
import { ServiceError } from '@/services/error'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import {
    defineSubOperation,
} from '@/services/serviceOperation'

const create = defineSubOperation({
    dataSchema: () => articleSectionSchemas.create,
    operation: () => ({ prisma, data }) =>
        prisma.articleSection.create({
            data,
            include: articleSectionsRelationsIncluder
        })
})

const destroy = defineSubOperation({
    paramsSchema: () => articleSectionSchemas.params,
    operation: () => ({ prisma, params }) =>
        prisma.articleSection.delete({
            where: params.articleSectionId ? { id: params.articleSectionId } : { name: params.articleSectionName },
            include: articleSectionsRelationsIncluder
        })
})

export const articleSectionOperations = {
    create,
    destroy,
    /**
     * This is the function that updates an article section metadata about how the (cms)image is displayed
     * in the article section. It will also change the image size (resolution) based on the image size in
     * the article section
     * @param params - name or id
     * @param data - The position and size data
     */
    update: defineSubOperation({
        paramsSchema: () => articleSectionSchemas.params,
        dataSchema: () => articleSectionSchemas.update,
        operation: () => ({ prisma, params, data }) =>
            prisma.articleSection.update({
                where: params.articleSectionId ? { id: params.articleSectionId } : { name: params.articleSectionName },
                data: {
                    imageSize: data.imageSize,
                    imagePosition: data.position,
                },
                include: articleSectionsRelationsIncluder,
            })
    }),

    /**
     * This is the function that adds a part to an article section. The part can be a cmsImage, cmsParagraph.
     * If the part already exists in the article section, it will return an error
     * If it does not it will create the part and add it to the article section
     * @param params - The name or id of the article section to add the part to
     * @param part - The part to add to the article section cmsImage, cmsParagraph or cmsLink
     * @returns - The updated article section
     */
    addPart: defineSubOperation({
        paramsSchema: () => articleSectionSchemas.params,
        dataSchema: () => articleSectionSchemas.addPart,
        operation: () => async ({ prisma, params, data }) => {
            const where = params.articleSectionId ? { id: params.articleSectionId } : { name: params.articleSectionName }

            const articleSection = await prisma.articleSection.findUnique({
                where,
                include: { [data.part]: true }
            })
            if (!articleSection) {
                throw new ServiceError('NOT FOUND', 'ArticleSection not found')
            }
            if (articleSection[data.part]) {
                throw new ServiceError('BAD PARAMETERS', `ArticleSection already has ${data.part}`)
            }

            switch (data.part) {
                case 'cmsImage':
                {
                    const cmsImage = await cmsImageOperations.create.internalCall({
                        data: {},
                        operationImplementationFields: { special: null }
                    })
                    return await prisma.articleSection.update({
                        where,
                        data: { cmsImage: { connect: { id: cmsImage.id } } },
                        include: articleSectionsRelationsIncluder
                    })
                }
                case 'cmsParagraph':
                {
                    const cmsParagraph = await cmsParagraphOperations.create.internalCall({
                        data: {},
                        operationImplementationFields: { special: null }
                    })
                    return await prisma.articleSection.update({
                        where,
                        data: { cmsParagraph: { connect: { id: cmsParagraph.id } } },
                        include: articleSectionsRelationsIncluder
                    })
                }
                case 'cmsLink':
                {
                    const cmsLink = await cmsLinkOperations.create.internalCall({
                        data: { text: 'lenke', url: './' },
                        operationImplementationFields: { special: null }
                    })
                    return await prisma.articleSection.update({
                        where,
                        data: { cmsLink: { connect: { id: cmsLink.id } } },
                        include: articleSectionsRelationsIncluder
                    })
                }
                default:
                    break
            }
            throw new ServiceError('BAD PARAMETERS', 'Invalid part')
        }
    }),

    /**
     * This is a function that removes a part from an article section. The part can be a cmsImage, cmsParagraph.
     * It does so by deleting the associated part from the database, in tern setting the part to null in the article section
     * If the attribute destroyOnEmpty is true, it will also remove the article section if all parts are removed
     * @param params - The name or id of the article section to remove the part from
     * @param part - The part to remove from the article section cmsImage, cmsParagraph or cmsLink
     * @param operationImplementationFields - destroyOnEmpty - this is an imporant atribute as when articles use a
     * articleSection it wishes to remove the article section if all parts are removed, but if a service only uses
     * one articleSection you do not want to delete it even if it has no content.
     * @returns - The updated article section
     */
    removePart: defineSubOperation({
        paramsSchema: () => articleSectionSchemas.params,
        dataSchema: () => articleSectionSchemas.removePart,
        operation: ({ destroyOnEmpty }: { destroyOnEmpty: boolean }) => async ({ prisma, params, data }) => {
            const where = params.articleSectionId ? { id: params.articleSectionId } : { name: params.articleSectionName }
            const articleSection = await prisma.articleSection.findUnique({
                where,
                include: { cmsLink: true, cmsParagraph: true, cmsImage: true }
            })
            if (!articleSection) {
                throw new ServiceError('NOT FOUND', 'ArticleSection not found')
            }
            if (!articleSection[data.part]) {
                throw new ServiceError('BAD PARAMETERS', `ArticleSection does not have ${data.part}`)
            }

            switch (data.part) {
                case 'cmsLink':
                    if (articleSection.cmsLink) {
                        await cmsLinkOperations.destroy.internalCall({
                            params: { linkId: articleSection.cmsLink.id },
                        })
                    }
                    break
                case 'cmsParagraph':
                    if (articleSection.cmsParagraph) {
                        await cmsParagraphOperations.destroy.internalCall({
                            params: { paragraphId: articleSection.cmsParagraph.id },
                        })
                    }
                    break
                case 'cmsImage':
                    if (articleSection.cmsImage) {
                        await cmsImageOperations.destroy.internalCall({
                            params: { cmsImageId: articleSection.cmsImage.id },
                        })
                    }
                    break
                default:
                    break
            }

            // check if all Parts are removed and if so, remove the articleSection,
            // but only if destroyOnEmpty is true
            const afterDelete = await prisma.articleSection.findUnique({
                where,
                include: { cmsParagraph: true, cmsImage: true, cmsLink: true }
            })
            if (!afterDelete) {
                throw new ServiceError('UNKNOWN ERROR', 'Noe uventet skjedde etter sletting av del av artclesection')
            }
            if (
                destroyOnEmpty &&
                !afterDelete.cmsImage &&
                !afterDelete.cmsParagraph &&
                !afterDelete.cmsLink
            ) {
                return await destroy.internalCall({
                    params: { articleSectionId: articleSection.id },
                })
            }

            return afterDelete
        }
    })
} as const
