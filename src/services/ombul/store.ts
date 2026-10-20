import '@pn-server-only'
import { implementStore } from '@/lib/store/implementStore'
import { createOrphanDestroyer } from '@/lib/store/orphanDestroyer'
import { prisma } from '@/prisma-pn-client-instance'

/** Where the ombul service keeps its pdfs. */
export const ombulStore = implementStore({
    staticStorePrefix: 'ombul',
    allowedExtentions: ['pdf'],
})

/** Destroys the pdfs in the ombul store no ombul refers to. See createOrphanDestroyer. */
export const destroyOmbulOrphans = createOrphanDestroyer(ombulStore, {
    context: 'the ombul store',
    referenced: async fsLocations => new Set((await prisma.ombul.findMany({
        where: { fsLocation: { in: fsLocations } },
        select: { fsLocation: true },
    })).map(ombul => ombul.fsLocation)),
})
