import '@pn-server-only'
import { articleSectionOperations } from '@/cms/articleSections/operations'
import type { Prisma } from '@/prisma-generated-pn-types'

/** Deletes the groups, their members and their article sections. Run it on the caller's transaction. */
export async function destroyRevueGroups(tx: Prisma.TransactionClient, where: Prisma.RevueGroupWhereInput) {
    const groups = await tx.revueGroup.findMany({ where, select: { articleSectionId: true } })
    await tx.revueGroup.deleteMany({ where })
    await Promise.all(groups.map(group => articleSectionOperations.destroy.internalCall({
        prisma: tx,
        params: { articleSectionId: group.articleSectionId },
    })))
}
