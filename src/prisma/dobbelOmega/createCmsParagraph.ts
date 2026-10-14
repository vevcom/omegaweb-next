import { cmsParagraphOperations } from '@/services/cms/paragraphs/operations'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'

/**
 * Creates a CmsParagraph with rendered contentHtml by delegating to the same
 * cmsParagraphOperations.updateContent used by the live app, instead of duplicating
 * the markdown->html pipeline here.
 */
export async function createCmsParagraph(pnPrisma: PrismaClientPn, markdown: string) {
    const paragraph = await pnPrisma.cmsParagraph.create({ data: {} })
    await cmsParagraphOperations.updateContent.internalCall({
        prisma: pnPrisma,
        params: { paragraphId: paragraph.id },
        data: { markdown },
    })
    return paragraph
}
