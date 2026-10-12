import { companyOperations } from '@/services/career/companies/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const COMPANY_COUNT = 100

const SPONSORS_BY_INDEX = {
    0: { sponsorTier: 'SPONSOR', website: 'https://www.vevcom.no' },
    1: { sponsorTier: 'SPONSOR', website: null },
} as const

const devCompanySponsor = (index: number) =>
    SPONSORS_BY_INDEX[index as keyof typeof SPONSORS_BY_INDEX] ?? { sponsorTier: 'NONE', website: null }

export const devCompanyName = (index: number) => `dev_companies_${index}`

export const seedDevCompanies = defineSeedOperation(async (prisma: PrismaClient) => {
    await Promise.all(Array.from({ length: COMPANY_COUNT }).map((_, index) => upsert({
        checkExistence: () => prisma.company.findUnique({
            where: { name: devCompanyName(index) },
            select: { id: true },
        }),
        create: async () => {
            const company = await companyOperations.create({
                data: {
                    name: devCompanyName(index),
                    description: `${devCompanyName(index)} description`,
                }
            })
            await prisma.company.update({
                where: { id: company.id },
                data: devCompanySponsor(index),
            })
        },
        update: () => Promise.resolve(),
    })))
})
