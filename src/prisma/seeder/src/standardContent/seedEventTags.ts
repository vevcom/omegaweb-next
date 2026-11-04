import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { EventTag, SpecialEventTags } from '@/prisma-generated-pn-types'

type SeedEventTagConfig = Omit<EventTag, 'id' | 'special' | 'createdAt' | 'updatedAt'> & {
    special: SpecialEventTags,
}

export const seedEventTagsConfig = [
    {
        special: 'COMPANY_PRESENTATION',
        name: 'BedPres',
        description: 'Bedriftspresentasjon',
        colorR: 255,
        colorG: 0,
        colorB: 0,
    },
] as const satisfies SeedEventTagConfig[]

/**
 * Upserts the special event tags, keyed on their unique special. An existing tag is left
 * untouched - its name, description and colour may have been edited since.
 */
export const seedEventTags = defineSeedOperation(async (prisma: PrismaClient) => {
    await Promise.all(seedEventTagsConfig.map(tag => prisma.eventTag.upsert({
        where: { special: tag.special },
        update: {},
        create: tag,
    })))
})
