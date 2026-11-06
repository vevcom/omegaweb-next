import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { revueGroupMemberOperations } from '@/services/revue/groups/members/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const revues = [
    { year: 2026, name: 'Kaffemaskinen slår tilbake' },
    { year: 2025, name: 'Det store kabelbruddet' },
    { year: 2024, name: 'Revyen uten navn' },
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
            const { id: revueId } = await revueOperations.create({ data: revue })
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
        update: () => {},
    })))
})
