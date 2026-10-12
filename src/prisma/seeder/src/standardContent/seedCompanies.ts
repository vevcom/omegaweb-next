import { companyOperations } from '@/services/career/companies/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import { getImageForCmsImageRelation } from '@/seeder/src/standardContent/seedImages'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { ImagesAvailablieForCms } from '@/seeder/src/standardContent/seedImages'
import type { Data } from '@/services/serviceOperation'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'

type SeedCompanyConfig = Data<typeof companyOperations.create> & {
    logo: ImagesAvailablieForCms,
    sponsor?: {
        sponsorTier: CompanySponsorTier,
        website: string | null,
    },
}

/**
 * Omegaweb-basic had no companies and no job ads, so DobbelOmega has nothing to bring
 * across for the career section. Companies were still only ever created by
 * seedDevCompanies, which does not run on a migrating import - leaving a production
 * import with an empty company register and no company to hang a job ad off.
 *
 * These are the sponsors the site already ships logos for. Extend the list as Bedkom
 * signs new ones; the job ads themselves are written in the new site rather than seeded.
 */
export const seedCompaniesConfig = [
    {
        name: 'Kongsberg Gruppen',
        description: 'Internasjonal teknologikonsern innen forsvar, maritime systemer og romfart.',
        logo: { dynamicImageSeededForCmsName: 'kongsberg' },
        sponsor: { sponsorTier: 'SPONSOR', website: 'https://www.kongsberg.com' },
    },
    {
        name: 'Nordic Semiconductor',
        description: 'Trondheimsbasert produsent av trådløse kretsløsninger for IoT.',
        logo: { dynamicImageSeededForCmsName: 'nordic' },
        sponsor: { sponsorTier: 'MAIN', website: 'https://www.nordicsemi.com' },
    },
] as const satisfies SeedCompanyConfig[]

/**
 * Upserts the companies given by the config, keyed on the unique company name. An
 * existing company is left untouched - its description and logo may have been edited
 * through the admin pages since, and a seed run should not undo that. The single
 * exception is a logo that never got an image connected at all; see attachMissingLogo.
 */
export const seedCompanies = defineSeedOperation(async (prisma: PrismaClient) => {
    await Promise.all(seedCompaniesConfig.map(company => upsertCompany(prisma, company)))
})

async function upsertCompany(prisma: PrismaClient, company: SeedCompanyConfig) {
    // Looked up before anything is written. companyOperations.create commits on its own,
    // so a logo that cannot be resolved afterwards leaves a company the name check skips
    // on every later run - permanently stuck with a logo pointing at no image.
    const logo = await getImageForCmsImageRelation(company.logo, prisma)

    return upsert({
        checkExistence: () => prisma.company.findUnique({
            where: { name: company.name },
            select: { id: true },
        }),
        create: () => createCompany(prisma, company, logo.id),
        update: () => attachMissingLogo(prisma, company.name, logo.id),
    })
}

async function createCompany(prisma: PrismaClient, company: SeedCompanyConfig, imageId: number) {
    const createdCompany = await companyOperations.create({
        data: { name: company.name, description: company.description }
    })

    // companyOperations.create makes the logo CmsImage but has no way to point it at an
    // actual image, so the image is connected here.
    await connectLogo(prisma, createdCompany.id, imageId)

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
 * The one thing an existing company is not left alone about. A logo CmsImage with no image
 * on it is an earlier run that died between creating the company and connecting its logo,
 * and nothing else will ever fill it in - the name check makes every later run skip the
 * company entirely. A logo that already has an image is untouched, so one swapped through
 * the admin pages stays swapped.
 */
async function attachMissingLogo(prisma: PrismaClient, name: string, imageId: number) {
    const existing = await prisma.company.findUniqueOrThrow({
        where: { name },
        select: { id: true, logo: { select: { imageId: true } } },
    })
    if (existing.logo.imageId !== null) return

    await connectLogo(prisma, existing.id, imageId)
}

async function connectLogo(prisma: PrismaClient, companyId: number, imageId: number) {
    await prisma.company.update({
        where: { id: companyId },
        data: {
            logo: {
                update: {
                    image: { connect: { id: imageId } }
                }
            }
        }
    })
}
