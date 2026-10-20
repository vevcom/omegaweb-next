import '@pn-server-only'
import { cmsParagraphSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import logger from '@/lib/logger'
import { markdownToSafeHtml } from '@/lib/html/safeHtml'
import type { SpecialCmsParagraph } from '@/prisma-generated-pn-types'

const create = defineSubOperation({
    dataSchema: () => cmsParagraphSchemas.data.create,
    operation: (
        { special }: { special: SpecialCmsParagraph | null }
    ) => async ({ data, prisma }) => await prisma.cmsParagraph.create({ data: { ...data, special } })
})

const generateSpecialCmsParagraphFromConfig = defineSubOperation({
    paramsSchema: () => cmsParagraphSchemas.params.generateSpecialCmsParagraphFromConfig,
    operation: () => async ({ params }) => create.internalCall({
        data: {},
        operationImplementationFields: { special: params.special }
    })
})

export const cmsParagraphOperations = {
    create,
    generateSpecialCmsParagraphFromConfig,

    destroy: defineSubOperation({
        paramsSchema: () => cmsParagraphSchemas.params.destroy,
        operation: () => async ({ params, prisma }) => {
            const paragraph = await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: params.paragraphId } })
            if (paragraph.special) {
                throw new ServiceError('BAD PARAMETERS', 'Spesielle avsnitt kan ikke slettes')
            }
            await prisma.cmsParagraph.delete({ where: { id: params.paragraphId } })
        }
    }),

    readSpecial: defineSubOperation({
        paramsSchema: () => cmsParagraphSchemas.params.readSpecial,
        operation: () => async ({ params, prisma }) => {
            const paragraph = await prisma.cmsParagraph.findUnique({ where: { special: params.special } })
            if (paragraph) return paragraph
            logger.error(`Could not find special cms paragraph with special ${params.special} - creating it!`)
            return await generateSpecialCmsParagraphFromConfig.internalCall({ params: { special: params.special } })
        }
    }),

    update: defineSubOperation({
        paramsSchema: () => cmsParagraphSchemas.params.update,
        dataSchema: () => cmsParagraphSchemas.data.update,
        operation: () => async ({ params, prisma, data }) => {
            const paragraph = await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: params.paragraphId } })
            if (paragraph.special) {
                throw new ServiceError('BAD PARAMETERS', 'Metadataene til spesielle avsnitt kan ikke endres')
            }
            await prisma.cmsParagraph.update({ where: { id: params.paragraphId }, data })
        }
    }),

    updateContent: defineSubOperation({
        paramsSchema: () => cmsParagraphSchemas.params.updateContent,
        dataSchema: () => cmsParagraphSchemas.data.updateContent,
        operation: () => async ({ params, prisma, data }) => {
            const safeHtml = await markdownToSafeHtml(data.markdown).catch(() => {
                throw new ServiceError('BAD PARAMETERS', 'Ugyldig Markdown')
            })
            const contentHtml = safeHtml
                .replace(/<img[^>]*>/g, 'Bilder i markdown er ikke støttet. Bruk det innebygde bildeverktøyet.')
            return await prisma.cmsParagraph.update({
                where: {
                    id: params.paragraphId
                },
                data: {
                    contentMd: data.markdown,
                    contentHtml,
                }
            })
        }
    }),

    /**
     * Check if a paragraph with id is special with special atribute
     * in the provided special array
     * This is useful to do ownership checks for services using special paragraphs.
     */
    isSpecial: defineSubOperation({
        paramsSchema: () => cmsParagraphSchemas.params.isSpecial,
        operation: () => async ({ params, prisma }) => {
            const paragraph = await prisma.cmsParagraph.findUnique({
                where: {
                    id: params.paragraphId,
                },
                select: {
                    special: true
                }
            })
            if (!paragraph) throw new ServiceError('NOT FOUND', 'Fant ikke avsnittet')
            if (!paragraph.special) return false
            return params.special.includes(paragraph.special)
        }
    })
} as const
