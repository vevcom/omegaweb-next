import { createProgressBar } from './progressBar'
import type { IdMapper } from './IdMapper'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'

/**
 * This function migrates image collections from Omegaweb-basic to PN
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @returns - IdMapper - A map of the old and new id's of the image collections
 */
export default async function migrateImageCollections(pnPrisma: PrismaClientPn, owPrisma: PrismaClientOw) {
    const imageCollections = await owPrisma.imageGroups.findMany()

    const IdMap: IdMapper = []
    const bar = createProgressBar('Migrating image collections', imageCollections.length)
    for (const imageCollection of imageCollections) {
        const collectionsWithSameName = await pnPrisma.imageCollection.findMany({
            where: {
                name: imageCollection.name
            }
        })

        const name = imageCollection.name + (collectionsWithSameName.length ? `(${collectionsWithSameName.length})` : '')

        const collection = await pnPrisma.imageCollection.upsert({
            where: {
                name: imageCollection.name
            },
            update: {

            },
            create: {
                name,
                description: 'Denne samlingen ble migrert fra Omegaweb-basic',
                createdAt: imageCollection.updatedAt,
                updatedAt: imageCollection.updatedAt,
                //TODO: Link to right committee through visibility
                visibilityRegular: {
                    create: {} //Assuming all collections from omegaweb-basic to be public on migration is probably fine
                },
                visibilityAdmin: {
                    create: { requirements: { create: [{}] } }
                }
            }
        })
        IdMap.push({ owId: imageCollection.id, pnId: collection.id })
        bar.increment()
    }
    bar.stop()
    return IdMap
}
