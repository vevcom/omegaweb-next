import { seedDevEvents } from '@/prisma/seeder/src/development/seedDevEvents'
import { DEV_COMMITTEE_SHORT_NAME, seedDevGroups } from '@/prisma/seeder/src/development/seedDevGroups'
import { seedDevImages } from '@/prisma/seeder/src/development/seedDevImages'
import { seedDevUsers } from '@/prisma/seeder/src/development/seedDevUsers'
import { prisma } from '@/prisma-pn-client-instance'
import { beforeAll, describe, expect, test } from '@jest/globals'

describe('seedDevEvents', () => {
    beforeAll(async () => {
        await seedDevImages()
        await seedDevGroups()
        await seedDevUsers()
        await seedDevEvents()
    }, 240 * 1000)

    test('publishes every event it seeds, administrated by the dev committee', async () => {
        const committee = await prisma.committee.findUniqueOrThrow({ where: { shortName: DEV_COMMITTEE_SHORT_NAME } })
        const events = await prisma.event.findMany({
            select: {
                name: true,
                published: true,
                visibilityAdmin: { select: { requirements: { select: { conditions: { select: { groupId: true } } } } } },
            },
        })

        expect(events.length).toBeGreaterThan(0)
        expect(events.filter(event => !event.published).map(event => event.name)).toEqual([])
        events.forEach(event => {
            expect(event.visibilityAdmin.requirements).toEqual([{ conditions: [{ groupId: committee.groupId }] }])
        })
    })
})
