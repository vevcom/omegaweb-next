import { companyOperations } from '@/services/careers/companies/operations'
import { standardStoreFiles } from '@/lib/standardStore/files'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { StandardStoreFile } from '@/lib/standardStore/files'
import type { Data } from '@/services/serviceOperation'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'

type SeedCompanyConfig = Data<typeof companyOperations.create> & {
    logo: StandardStoreFile,
    sponsor?: {
        sponsorTier: CompanySponsorTier,
        website: string | null,
    },
}

/**
 * Production has no other source of companies than this seed, since seedDevCompanies only
 * runs in development, and a job ad needs a company to hang off.
 *
 * These are the sponsors the site already ships logos for. Extend the list as Bedkom
 * signs new ones; the job ads themselves are written in the new site rather than seeded.
 */
export const seedCompaniesConfig = [
    {
        name: 'Kongsberg Gruppen',
        description: 'Internasjonalt teknologikonsern innen forsvar, maritime systemer og romfart.',
        logo: standardStoreFiles.kongsberg,
        sponsor: { sponsorTier: 'SPONSOR', website: 'https://www.kongsberg.com' },
    },
    {
        name: 'Nordic Semiconductor',
        description: 'Trondheimsbasert produsent av trådløse kretsløsninger for IoT.',
        logo: standardStoreFiles.nordic,
        sponsor: { sponsorTier: 'MAIN', website: 'https://www.nordicsemi.com' },
    },
] as const satisfies SeedCompanyConfig[]

/**
 * Upserts the companies given by the config, keyed on the unique company name. An
 * existing company is left untouched - its description and logo may have been edited
 * through the admin pages since, and a seed run should not undo that. The single
 * exception is a company with no logo at all; see uploadMissingLogo.
 */
export const seedCompanies = defineSeedOperation(async (prisma: PrismaClient) => {
    await Promise.all(seedCompaniesConfig.map(company => upsertCompany(prisma, company)))
})

async function upsertCompany(prisma: PrismaClient, company: SeedCompanyConfig) {
    return upsert({
        checkExistence: () => prisma.company.findUnique({
            where: { name: company.name },
            select: { id: true },
        }),
        create: () => createCompany(prisma, company),
        update: () => uploadMissingLogo(prisma, company),
    })
}

async function createCompany(prisma: PrismaClient, company: SeedCompanyConfig) {
    const createdCompany = await companyOperations.create({
        data: { name: company.name, description: company.description }
    })

    await uploadLogo(createdCompany.id, company.logo)

    if (company.sponsor) {
        await companyOperations.updateSponsorTier({
            params: { id: createdCompany.id },
            data: { sponsorTier: company.sponsor.sponsorTier },
        })
        await prisma.company.update({
            where: { id: createdCompany.id },
            data: { website: company.sponsor.website },
        })
    }

    return createdCompany
}

/**
 * The one thing an existing company is not left alone about. A company with no logo is an
 * earlier run that died between creating the company and uploading its logo, and nothing else
 * will ever fill it in - the name check makes every later run skip the company entirely. A
 * company that has a logo is untouched, so one swapped through the admin pages stays swapped.
 */
async function uploadMissingLogo(prisma: PrismaClient, company: SeedCompanyConfig) {
    const existing = await prisma.company.findUniqueOrThrow({
        where: { name: company.name },
        select: { id: true, logoImageId: true },
    })
    if (existing.logoImageId !== null) return

    await uploadLogo(existing.id, company.logo)
}

async function uploadLogo(companyId: number, logo: StandardStoreFile) {
    await companyOperations.updateLogo({
        params: { id: companyId },
        data: { imageFile: await logo.file() },
    })
}
