import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const interestGroups: {
    name: string,
    url: string
}[] = [
    {
        name: 'Omega Integarn',
        url: 'https://www.facebook.com/groups/omegaintegarn/',
    },
    {
        name: 'Omega Lavpassfil(m)ter',
        url: 'https://www.facebook.com/groups/1191337511256303/',
    },
    {
        name: 'Omega Smashbros',
        url: 'https://www.facebook.com/groups/539139876817932/',
    },
    {
        name: 'Omega Topptur',
        url: 'https://www.facebook.com/groups/441437179897894/',
    },
    {
        name: 'Omega SeFotball',
        url: 'https://www.facebook.com/groups/1893717857436467/',
    },
    {
        name: 'Omega Badeclubb',
        url: 'https://www.facebook.com/groups/196138748516983',
    },
    {
        name: 'Steingjengen',
        url: 'https://www.facebook.com/groups/3095703260715088',
    },
    {
        name: 'Omega Formelsamling',
        url: 'https://www.facebook.com/groups/523370429095199/',
    },
    {
        name: 'Omega Yatzy',
        url: 'https://www.facebook.com/groups/717061329329972/',
    },
    {
        name: 'Spillkretsen',
        url: 'https://www.facebook.com/groups/313197997852553/',
    },
    {
        name: 'Omega Puslespill',
        url: 'https://www.facebook.com/groups/589493906548263/',
    },
    {
        name: 'Omega Systre',
        url: 'https://www.facebook.com/groups/1235153214107409/',
    },
    {
        name: 'Omega Håndball',
        url: 'https://www.facebook.com/groups/7473447119423028/',
    },
    {
        name: 'Omega Kondisatorane',
        url: 'https://www.facebook.com/groups/689162269810343/',
    },
    {
        name: 'St. Quiz Omega',
        url: 'https://www.facebook.com/groups/3859557797704270/',
    },
    {
        name: 'Omega TUR',
        url: 'https://www.facebook.com/groups/931010798841182/',
    },
    {
        name: 'Trondheim Tabataforening',
        url: 'https://www.facebook.com/groups/624129628827521/',
    },
    {
        name: 'Omega Kite',
        url: 'https://www.facebook.com/groups/1411618774258694/',
    },
    {
        name: 'Omega Basket',
        url: 'https://www.facebook.com/groups/1328303331832130/',
    },
]

/**
 * Upserts the interest groups given by the config. InterestGroup.name is not unique, so an existing
 * group is matched on name and left untouched - its article section, members and pensioned state
 * are all edited through the site, and a seed run should not undo that.
 */
export const seedInterestGroups = defineSeedOperation(async (prisma: PrismaClient) => {
    const { order } = await prisma.omegaOrder.findFirstOrThrow({
        orderBy: {
            order: 'desc'
        },
    })

    await Promise.all(interestGroups.map(group => upsert({
        checkExistence: () => prisma.interestGroup.findFirst({
            where: { name: group.name },
            select: { id: true },
        }),
        create: () => prisma.interestGroup.create({
            data: {
                name: group.name,
                articleSection: {
                    create: {
                        cmsImage: { create: {} },
                        cmsParagraph: { create: {} },
                        cmsLink: {
                            create: {
                                url: group.url,
                                text: 'Facebookgruppe'
                            }
                        },
                    }
                },
                group: {
                    create: {
                        groupType: 'INTEREST_GROUP',
                        order,
                    },
                },
            }
        }),
        update: () => Promise.resolve(),
    })))
})
