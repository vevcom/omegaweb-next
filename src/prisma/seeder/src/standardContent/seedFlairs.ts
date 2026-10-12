import { flairOperations } from '@/services/flairs/operations'
import { standardStoreFiles } from '@/lib/standardStore/files'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { StandardStoreFile } from '@/lib/standardStore/files'
import type { Data } from '@/services/serviceOperation'

type SeedFlairConfig = Pick<Data<typeof flairOperations.create>, 'name' | 'color'> & {
    standardStoreFile: StandardStoreFile,
}

export const seedFlairsConfig = [
    {
        name: 'Påskekappe',
        color: '#FFFF99',
        standardStoreFile: standardStoreFiles.kappemannPaske,
    },
    {
        name: 'Diamantkappe',
        color: '#00CCFF',
        standardStoreFile: standardStoreFiles.kappemannDiamant,
    },
    {
        name: 'Gullkappe',
        color: '#FFD700',
        standardStoreFile: standardStoreFiles.kappemannGull,
    },
    {
        name: 'Solvkappe',
        color: '#D9D9D9',
        standardStoreFile: standardStoreFiles.kappemannSolv,
    },
    {
        name: 'Bronsekappe',
        color: '#FF9900',
        standardStoreFile: standardStoreFiles.kappemannBronse,
    },
] as const satisfies SeedFlairConfig[]

/**
 * Upserts all flairs in the intended rank order given by the config.
 */
export const seedFlairs = defineSeedOperation(async (prisma: PrismaClient) => {
    for (const flair of seedFlairsConfig) {
        await upsertFlair(prisma, flair)
    }
})

async function upsertFlair(prisma: PrismaClient, flair: SeedFlairConfig) {
    return upsert({
        checkExistence: () => prisma.flair.findFirst({
            where: { name: flair.name },
            select: { id: true }
        }),
        create: () => createFlair(flair),
        update: () => Promise.resolve(),
    })
}

async function createFlair(flair: SeedFlairConfig) {
    const uploadData = await flair.standardStoreFile.imageUploadData({ name: flair.name, alt: flair.name })
    return flairOperations.create({
        data: {
            name: flair.name,
            color: flair.color,
            ...uploadData,
        }
    })
}
