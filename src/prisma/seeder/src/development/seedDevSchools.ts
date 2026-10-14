import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const SCHOOL_COUNT = 15

export const seedDevSchools = defineSeedOperation(async (prisma: PrismaClient) => {
    await Promise.all(Array.from({ length: SCHOOL_COUNT }).map((_, index) => prisma.school.upsert({
        where: { shortName: `dev_schools_${index}` },
        update: {},
        create: {
            name: `dev_schools_${index}`,
            shortName: `dev_schools_${index}`,
            cmsImage: {
                create: {
                    name: `dev_schools_${index}`
                }
            },
            cmsParagraph: {
                create: {
                    name: `dev_schools_${index}`
                }
            },
            cmsLink: {
                create: {
                    name: `dev_schools_${index}`
                }
            },
        }
    })))
})
