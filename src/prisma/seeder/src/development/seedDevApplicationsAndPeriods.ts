import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { videoLinkDefaultText, videoLinkUnsetUrl } from '@/services/applications/committeeParticipation/constants'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * Upserts the dev application periods (keyed on name), every committee's participation in each,
 * and an application from every user to every participating committee. Additive, so committees and
 * users added since the last run are filled in too.
 */
export const seedDevApplicationsAndPeriods = defineSeedOperation(async (prisma: PrismaClient) => {
    const applicationText = `
    Duis dolore minim pariatur quis do ut laboris sit esse laborum quis
    sint.Nisi eu consectetur officia irure proident magna culpa sunt.Lorem 
    reprehenderit pariatur est fugiat ea.Labore aliqua in eu veniam ex velit excepteur 
    sunt amet amet minim voluptate qui pariatur.Exercitation proident cupidatat adipisicing in incididunt 
    excepteur id aliquip sit.Dolor velit deserunt pariatur ipsum velit aute eu eiusmod esse.Voluptate veniam
     esse nostrud duis elit cillum laborum mollit magna consectetur dolore sit commodo.
    `
    const committees = await prisma.committee.findMany({})
    const users = await prisma.user.findMany({})

    const applicationPeriods = await Promise.all([
        {
            endDate: new Date('2100-03-25'),
            endPriorityDate: new Date('2100-03-28'),
            startDate: new Date('2026-01-25'),
        },
        {
            endDate: new Date('2025-03-25'),
            endPriorityDate: new Date('2025-03-25'),
            startDate: new Date('2025-03-01'),
        },
        {
            endDate: new Date('2024-03-25'),
            endPriorityDate: new Date('2024-03-25'),
            startDate: new Date('2024-03-01'),
        },
        {
            endDate: new Date('2023-03-25'),
            endPriorityDate: new Date('2023-03-25'),
            startDate: new Date('2023-03-01'),
        },
    ].map((applicationPeriod, index) => prisma.applicationPeriod.upsert({
        where: { name: `dev_application_periods_${index}` },
        update: {},
        create: {
            ...applicationPeriod,
            name: `dev_application_periods_${index}`,
        },
    })))

    await Promise.all(applicationPeriods.flatMap(applicationPeriod => committees.map(async committee => {
        const participation = await prisma.committeeParticipationInApplicationPeriod.upsert({
            where: {
                committeeId_applicationPeriodId: {
                    committeeId: committee.id,
                    applicationPeriodId: applicationPeriod.id,
                },
            },
            update: {},
            create: {
                committee: { connect: { id: committee.id } },
                applicationPeriod: { connect: { id: applicationPeriod.id } },
                paragraph: {
                    create: {
                        contentMd: `${committee.name} søker nye medlemmer!\n\n${applicationText}`,
                        contentHtml: `<p>${committee.name} søker nye medlemmer!</p><p>${applicationText}</p>`,
                    }
                },
                videoLink: {
                    create: {
                        text: videoLinkDefaultText,
                        // Every other one unset, so both states show up in dev.
                        url: committee.id % 2 === 0
                            ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                            : videoLinkUnsetUrl,
                    }
                },
            },
        })
        await prisma.application.createMany({
            data: users.map(user => ({
                priority: participation.committeeId,
                text:
                    committee.name
                    + applicationPeriod.startDate.toUTCString()
                    + applicationPeriod.endDate.toUTCString()
                    + applicationText,
                userId: user.id,
                applicationPeriodCommiteeId: participation.id,
                applicationPeriodId: participation.applicationPeriodId,
            })),
            skipDuplicates: true,
        })
    })))
})
