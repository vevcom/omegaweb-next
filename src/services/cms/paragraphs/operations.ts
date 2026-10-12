import '@pn-server-only'
import { cmsParagraphSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { SpecialCmsParagraph } from '@/prisma-generated-pn-types'
import logger from '@/lib/logger'
import { markdownToSafeHtml } from '@/lib/html/safeHtml'
import { z } from 'zod'

const create = defineSubOperation({
    dataSchema: () => cmsParagraphSchemas.create,
    operation: (
        { special }: { special: SpecialCmsParagraph | null }
    ) => async ({ data, prisma }) => await prisma.cmsParagraph.create({ data: { ...data, special } })
})

const generateSpecialCmsParagraphFromConfig = defineSubOperation({
    paramsSchema: () => z.object({
        special: z.nativeEnum(SpecialCmsParagraph)
    }),
    operation: () => async ({ params }) => create.internalCall({
        data: {},
        operationImplementationFields: { special: params.special }
    })
})

export const cmsParagraphOperations = {
    create,
    generateSpecialCmsParagraphFromConfig,

    destroy: defineSubOperation({
        paramsSchema: () => z.object({ paragraphId: z.number() }),
        operation: () => async ({ params, prisma }) => {
            const paragraph = await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: params.paragraphId } })
            if (paragraph.special) {
                throw new ServiceError('BAD PARAMETERS', 'Special paragraphs cannot be deleted')
            }
            await prisma.cmsParagraph.delete({ where: { id: params.paragraphId } })
        }
    }),

    readSpecial: defineSubOperation({
        paramsSchema: () => z.object({
            special: z.nativeEnum(SpecialCmsParagraph)
        }),
        operation: () => async ({ params, prisma }) => {
            const paragraph = await prisma.cmsParagraph.findUnique({ where: { special: params.special } })
            if (paragraph) return paragraph
            logger.error(`Could not find special cms paragraph with special ${params.special} - creating it!`)
            return await generateSpecialCmsParagraphFromConfig.internalCall({ params: { special: params.special } })
        }
    }),

    update: defineSubOperation({
        paramsSchema: () => z.object({
            paragraphId: z.number(),
        }),
        dataSchema: () => cmsParagraphSchemas.update,
        operation: () => async ({ params, prisma, data }) => {
            const paragraph = await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: params.paragraphId } })
            if (paragraph.special) {
                throw new ServiceError('BAD PARAMETERS', 'Special paragraphs cannot have their meta data updated')
            }
            await prisma.cmsParagraph.update({ where: { id: params.paragraphId }, data })
        }
    }),

    updateContent: defineSubOperation({
        paramsSchema: () => z.object({
            paragraphId: z.number(),
        }),
        dataSchema: () => cmsParagraphSchemas.updateContent,
        operation: () => async ({ params, prisma, data }) => {
            try {
                const contentHtml = (await markdownToSafeHtml(data.markdown))
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
            } catch {
                throw new ServiceError('BAD PARAMETERS', 'Invalid markdown')
            }
        }
    }),

    /**
     * Check if a paragraph with id is special with special atribute
     * in the provided special array
     * This is useful to do ownership checks for services using special paragraphs.
     */
    isSpecial: defineSubOperation({
        paramsSchema: () => z.object({
            paragraphId: z.number(),
            special: z.array(z.nativeEnum(SpecialCmsParagraph))
        }),
        operation: () => async ({ params, prisma }) => {
            const paragraph = await prisma.cmsParagraph.findUnique({
                where: {
                    id: params.paragraphId,
                },
                select: {
                    special: true
                }
            })
            if (!paragraph) throw new ServiceError('NOT FOUND', 'Paragraph not found')
            if (!paragraph.special) return false
            return params.special.includes(paragraph.special)
        }
    })
} as const
