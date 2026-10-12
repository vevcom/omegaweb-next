import { devCompanyName } from './seedDevCompanies'
import { jobAdOperations } from '@/services/career/jobAds/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { JobType } from '@/prisma-generated-pn-types'

/**
 * Upserts the dev job ads, all posted by the first dev company. A job ad has no unique key of its
 * own, so an existing one is recognised by its article name and left untouched.
 */
export const seedDevJobAds = defineSeedOperation(async (prisma: PrismaClient) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const image = await prisma.image.findUniqueOrThrow({
        where: {
            standardImage: 'FAIR',
        }
    })

    const jobAdData: {
        type: JobType,
        applicationDeadline: Date,
        articleName: string,
        description: string,
    }[] = [
        {
            type: 'FULL_TIME',
            applicationDeadline: tomorrow,
            articleName: 'Vever',
            description: 'Vevcom søker nye vevere for å febrisk kode ferdig projectNext',
        },
        {
            type: 'PART_TIME',
            applicationDeadline: tomorrow,
            articleName: 'Medlem i Hovedstyret',
            description: 'Er du flink til å gå? Da er du perfetk i rollen i HS',
        },
        {
            type: 'INTERNSHIP',
            applicationDeadline: tomorrow,
            articleName: 'Locmeister',
            description: 'Elsker du lokomotiv? Da er Locmeiser din drømme sommerjobb!',
        },
        {
            type: 'CONTRACT',
            applicationDeadline: tomorrow,
            articleName: 'Konsulent',
            description: 'Elsker du penger? Da er dette drømmen jobben for deg, her tjener du massevis av penger.',
        },
        {
            type: 'OTHER',
            applicationDeadline: tomorrow,
            articleName: 'Spåmann',
            description: 'Føler du at du kan se inn i fremtiden? Da vet du allerede om du får jobben eller ikke.',
        },
    ]

    const company = await prisma.company.findUniqueOrThrow({
        where: { name: devCompanyName(0) },
    })

    await Promise.all(jobAdData.map(jobAd => upsert({
        checkExistence: () => prisma.jobAd.findFirst({
            where: { articleName: jobAd.articleName },
            select: { id: true },
        }),
        create: async () => {
            const createdJobAd = await jobAdOperations.create({
                data: {
                    ...jobAd,
                    companyId: company.id,
                },
            })

            // jobAdOperations.create makes the cover CmsImage but has no way to point it at an
            // actual image, so the image is connected here.
            await prisma.article.update({
                where: {
                    id: createdJobAd.articleId
                },
                data: {
                    coverImage: {
                        update: {
                            image: {
                                connect: {
                                    id: image.id
                                }
                            }
                        }
                    }
                }
            })
        },
        update: () => Promise.resolve(),
    })))
})
