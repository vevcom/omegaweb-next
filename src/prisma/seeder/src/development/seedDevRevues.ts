import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPartitions } from '@/services/users/constants'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'

// Newest first. One light revue among dark ones, so both tones are seen.
const revues = [
    {
        year: 2026,
        name: 'Kaffemaskinen slår tilbake',
        palette: {
            themeBackground: '#f6efe3',
            themePrimary: '#8a3b12',
            themeSecondary: '#d9b98c',
            themeAccent: '#1f6f78',
        },
    },
    {
        year: 2025,
        name: 'Det store kabelbruddet',
        palette: {
            themeBackground: '#0d1424',
            themePrimary: '#3ec7ff',
            themeSecondary: '#283a6b',
            themeAccent: '#ffd23f',
        },
    },
    {
        year: 2024,
        name: 'Revyen uten navn',
        palette: {
            themeBackground: '#1d0f24',
            themePrimary: '#d46bff',
            themeSecondary: '#4a2a5c',
            themeAccent: '#7ee0a1',
        },
    },
]

// The titles of a group's members in each revue, the first of them its admin. The members are taken from
// the seeded users, starting at firstUser and moving two on for each earlier revue.
const subGroups = [
    { name: 'Skuespill', firstUser: 0, titles: ['Regissør', 'Skuespiller', 'Skuespiller', 'Skuespiller'] },
    { name: 'Band', firstUser: 4, titles: ['Kapellmester', 'Gitar', 'Bass', 'Trommer'] },
    { name: 'Teknikk', firstUser: 8, titles: ['Teknisk ansvarlig', 'Lys', 'Lyd'] },
]
const board = {
    name: 'Styret',
    committee: { name: 'Revystyret', shortName: 'revystyret' },
    firstUser: 12,
    titles: ['Leder', 'Kasserer', 'Styremedlem'],
}

/**
 * The revues, each with the same groups: three sub groups and the board, a committee. The newest revue's
 * groups are of Omega's current order and each earlier revue's of the order before.
 */
export const seedDevRevues = defineSeedOperation(async (prisma: PrismaClient) => {
    const users = await prisma.user.findMany({
        where: userPartitions.unarchived,
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 20,
    })
    const { order: currentOrder } = await omegaOrderOperations.readCurrent({})

    const seededRevues = await Promise.all(revues.map(async (revue, index) => ({
        id: await upsertRevue(prisma, revue),
        order: currentOrder - index,
        nthBack: index,
    })))
    const [newest, ...earlier] = seededRevues

    for (const subGroup of subGroups) {
        await upsert({
            checkExistence: () => prisma.revueGroup.findUnique({ where: { name: subGroup.name } }),
            create: async () => {
                const { id } = await revueGroupOperations.create({
                    params: { revueId: newest.id },
                    data: { type: 'REVUE_SUB_GROUP', name: subGroup.name },
                })
                await putInEarlierRevues(id)
                const { groupId } = await prisma.revueSubGroup.findFirstOrThrow({ where: { revueGroup: { id } } })
                for (const revue of seededRevues) {
                    await addMembers(revueSubGroupOperations, {
                        groupId,
                        order: revue.order,
                        titles: subGroup.titles,
                        users: rotated(users, subGroup.firstUser + revue.nthBack * 2),
                    })
                }
            },
            update: () => {},
        })
    }

    await upsert({
        checkExistence: () => prisma.revueGroup.findUnique({ where: { name: board.name } }),
        create: async () => {
            const committee = await committeeOperations.create({ data: board.committee })
            const { id } = await revueGroupOperations.create({
                params: { revueId: newest.id },
                data: { type: 'COMMITTEE', name: board.name, committeeId: committee.id },
            })
            await putInEarlierRevues(id)
            for (const revue of seededRevues) {
                await addMembers(committeeOperations, {
                    groupId: committee.groupId,
                    order: revue.order,
                    titles: board.titles,
                    users: rotated(users, board.firstUser + revue.nthBack),
                })
            }
        },
        update: () => {},
    })

    async function putInEarlierRevues(revueGroupId: number) {
        await Promise.all(earlier.map(revue => revueGroupOperations.internal.addToRevue.internalCall({
            params: { revueId: revue.id, revueGroupId },
            data: { order: revue.order },
        })))
    }
})

function upsertRevue(prisma: PrismaClient, revue: typeof revues[number]) {
    return upsert({
        checkExistence: () => prisma.revue.findUnique({ where: { year: revue.year }, select: { id: true } }),
        create: async () => (await revueOperations.create({
            data: { year: revue.year, name: revue.name, ...revue.palette },
        })).id,
        update: async () => {
            const { id: revueId } = await prisma.revue.findUniqueOrThrow({
                where: { year: revue.year },
                select: { id: true },
            })
            await revueOperations.update({ params: { revueId }, data: revue.palette })
            return revueId
        },
    })
}

type MemberOperations = Pick<typeof revueSubGroupOperations, 'addMembers' | 'setMemberTitle'>
    | Pick<typeof committeeOperations, 'addMembers' | 'setMemberTitle'>

/** Members of the group in the order, one per title, the first of them its admin. */
async function addMembers(operations: MemberOperations, { groupId, order, titles, users }: {
    groupId: number,
    order: number,
    titles: string[],
    users: { id: number }[],
}) {
    const members = titles.map((title, index) => ({ title, userId: users[index].id }))
    await operations.addMembers({
        params: { groupId, order },
        data: { users: members.map(({ userId }, index) => ({ userId, admin: index === 0 })) },
    })
    for (const { userId, title } of members) {
        await operations.setMemberTitle({ params: { groupId, order }, data: { userId, title } })
    }
}

function rotated<Item>(items: Item[], start: number): Item[] {
    return items.map((_item, index) => items[(start + index) % items.length])
}
