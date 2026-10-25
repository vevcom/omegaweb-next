import '@pn-server-only'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import type { ArticleSectionPart } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Creates an empty part of each kind through its own service, and returns the input that connects
 * it to its article section. Run it on the transaction that writes the section, so a failure leaves
 * no part behind.
 */
export const createArticleSectionPart = {
    cmsImage: async (prisma: Prisma.TransactionClient) => ({
        cmsImage: { connect: { id: (await cmsImageOperations.create.internalCall({
            data: {},
            prisma,
            operationImplementationFields: { special: null },
        })).id } },
    }),
    cmsParagraph: async (prisma: Prisma.TransactionClient) => ({
        cmsParagraph: { connect: { id: (await cmsParagraphOperations.create.internalCall({
            data: {},
            prisma,
            operationImplementationFields: { special: null },
        })).id } },
    }),
    cmsLink: async (prisma: Prisma.TransactionClient) => ({
        cmsLink: { connect: { id: (await cmsLinkOperations.create.internalCall({
            data: { text: 'Lenke', url: './' },
            prisma,
            operationImplementationFields: { special: null },
        })).id } },
    }),
} as const satisfies Record<
    ArticleSectionPart,
    (prisma: Prisma.TransactionClient) => Promise<Prisma.ArticleSectionUpdateInput>
>
