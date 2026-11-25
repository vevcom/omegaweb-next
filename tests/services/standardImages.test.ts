import { prisma } from '@/prisma-pn-client-instance'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { StandardImage } from '@/prisma-generated-pn-types'
import { describe, expect, test } from '@jest/globals'

describe('standard images', () => {
    test('are all made by the seed', async () => {
        const seeded = await prisma.image.findMany({
            where: { standardImage: { not: null } },
            select: { standardImage: true },
        })
        expect(seeded.map(image => image.standardImage).sort()).toEqual(Object.values(StandardImage).sort())
    })

    test('one missing from the database is made again when it is read', async () => {
        await prisma.image.delete({ where: { standardImage: 'REVUE_LOGO' } })

        await standardImageCollectionOperations.readAllStandardImages({})

        expect(await prisma.image.count({ where: { standardImage: 'REVUE_LOGO' } })).toBe(1)
    })
})
