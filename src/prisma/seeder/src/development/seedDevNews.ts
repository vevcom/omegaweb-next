import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const OLD_NEWS_COUNT = 60
const ACTIVE_NEWS_COUNT = 10

export const seedDevNews = defineSeedOperation(async (prisma: PrismaClient) => {
    const order = await prisma.omegaOrder.findFirst()
    if (!order) throw new Error('No omega order found to seed news to')

    const image = await prisma.image.findUniqueOrThrow({
        where: { standardImage: 'REALFAGSBYGGET' }
    })

    const oldEndDateTime = new Date()
    oldEndDateTime.setDate(oldEndDateTime.getDate() - 365)

    const activeEndDateTime = new Date()
    activeEndDateTime.setDate(activeEndDateTime.getDate() + 7)

    // Dev seed data is keyed as dev_<service>_<index> (here: dev_news_old_<index> /
    // dev_news_active_<index>) so re-seeding can find-or-create it by name instead of relying on
    // magic ids.
    await Promise.all([
        ...Array.from({ length: OLD_NEWS_COUNT }).map((_, index) => upsertTestNews(prisma, {
            name: `dev_news_old_${index}`,
            description: 'Omegaweb Next lanserer neste uke',
            endDateTime: oldEndDateTime,
            imageId: image.id,
        })),
        ...Array.from({ length: ACTIVE_NEWS_COUNT }).map((_, index) => upsertTestNews(prisma, {
            name: `dev_news_active_${index}`,
            description: 'Omegaweb Next lanserer neste uke',
            endDateTime: activeEndDateTime,
            imageId: image.id,
        })),
    ])
})

async function upsertTestNews(
    prisma: PrismaClient,
    news: { name: string, description: string, endDateTime: Date, imageId: number }
) {
    const existingNews = await prisma.newsArticle.findFirst({
        where: { articleName: news.name },
        select: { id: true }
    })

    return prisma.newsArticle.upsert({
        where: { id: existingNews?.id ?? -1 },
        update: {
            endDateTime: news.endDateTime,
        },
        create: {
            description: news.description,
            endDateTime: news.endDateTime,
            article: {
                create: {
                    name: news.name,
                    coverImage: {
                        create: {
                            image: {
                                connect: { id: news.imageId }
                            }
                        }
                    }
                }
            },
            visibilityRegular: {
                create: {}
            },
            // A requirement with no conditions can never be satisfied, so the admin level admits
            // only those who bypass it with NEWS_ADMIN - seeded news belongs to no group.
            visibilityAdmin: {
                create: {
                    requirements: { create: [{}] }
                }
            }
        }
    })
}
