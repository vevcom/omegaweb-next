import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { revueGroupMemberOperations } from '@/services/revue/groups/members/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'

// One light revue among dark ones, so both tones are seen.
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

const groups = [
    { name: 'Skuespill', members: ['Kari Nordmann', 'Ola Nordmann'] },
    { name: 'Band', members: ['Lise Lydsen', 'Per Perkusjon'] },
    { name: 'Teknikk', members: ['Sigrid Spot'] },
]

export const seedDevRevues = defineSeedOperation(async (prisma: PrismaClient) => {
    const user = await prisma.user.findFirst({ select: { id: true } })

    await Promise.all(revues.map(revue => upsert({
        checkExistence: () => prisma.revue.findUnique({ where: { year: revue.year }, select: { id: true } }),
        create: async () => {
            const { id: revueId } = await revueOperations.create({
                data: { year: revue.year, name: revue.name, ...revue.palette },
            })
            await Promise.all(groups.map(async group => {
                const { id: groupId } = await revueGroupOperations.create({
                    params: { revueId },
                    data: { name: group.name },
                })
                await Promise.all(group.members.map(name => revueGroupMemberOperations.create({
                    params: { groupId },
                    data: { type: 'DETAILS', name },
                })))
                if (user) {
                    await revueGroupMemberOperations.create({
                        params: { groupId },
                        data: { type: 'USER', userId: user.id },
                    })
                }
            }))
        },
        update: async () => {
            const { id: revueId } = await prisma.revue.findUniqueOrThrow({
                where: { year: revue.year },
                select: { id: true },
            })
            await revueOperations.update({ params: { revueId }, data: revue.palette })
        },
    })))
})
