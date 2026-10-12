import '@pn-server-only'
import { cmsLinkSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'
import { ServiceError } from '@/services/error'
import { SpecialCmsLink } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const create = defineSubOperation({
    dataSchema: () => cmsLinkSchemas.create,
    operation: (
        { special }: { special: SpecialCmsLink | null }
    ) => (
        { data, prisma }
    ) => prisma.cmsLink.create({
        data: { ...data, special }
    })
})

const generateSpecialCmsLinkFromConfig = defineSubOperation({
    paramsSchema: () => z.object({
        special: z.nativeEnum(SpecialCmsLink),
    }),
    operation: () => async ({ params: { special } }) => create.internalCall({
        data: { url: './', text: 'Default text' },
        operationImplementationFields: { special }
    })
})

export const cmsLinkOperations = {
    create,
    generateSpecialCmsLinkFromConfig,

    destroy: defineSubOperation({
        paramsSchema: () => z.object({
            linkId: z.number()
        }),
        operation: () => async ({ params, prisma }) => {
            const cmsLink = await prisma.cmsLink.findUniqueOrThrow({
                where: {
                    id: params.linkId
                }
            })
            if (cmsLink.special) throw new ServiceError('BAD PARAMETERS', 'Cannot delete special CMS link')
            await prisma.cmsLink.delete({
                where: {
                    id: params.linkId
                }
            })
        }
    }),

    update: defineSubOperation({
        paramsSchema: () => z.object({
            linkId: z.number()
        }),
        dataSchema: () => cmsLinkSchemas.update,
        operation: () => ({ prisma, params, data }) =>
            prisma.cmsLink.update({
                where: {
                    id: params.linkId
                },
                data: {
                    ...data,
                    url: data.url ?? './'
                }
            })
    }),

    readSpecial: defineSubOperation({
        paramsSchema: () => z.object({
            special: z.nativeEnum(SpecialCmsLink),
        }),
        operation: () => async ({ prisma, params: { special } }) => {
            const cmsLink = await prisma.cmsLink.findUnique({
                where: { special }
            })
            if (cmsLink) return cmsLink
            logger.error(`Could not find special cms link with special ${special} - creating it!`)
            return await generateSpecialCmsLinkFromConfig.internalCall({ params: { special } })
        }
    }),

    /**
     * Check if a link with id is special with special atribute
     * in the provided special array
     * This is useful to do ownership checks for services using special links.
     */
    isSpecial: defineSubOperation({
        paramsSchema: () => z.object({
            linkId: z.number(),
            special: z.array(z.nativeEnum(SpecialCmsLink))
        }),
        operation: () => async ({ params, prisma }) => {
            const link = await prisma.cmsLink.findUnique({
                where: {
                    id: params.linkId,
                },
                select: {
                    special: true
                }
            })
            if (!link) throw new ServiceError('NOT FOUND', 'Link not found')
            if (!link.special) return false
            return params.special.includes(link.special)
        }
    })
} as const
