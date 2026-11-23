import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { revueGroupMemberOperations } from '@/services/revue/groups/members/operations'
import { defaultRevuePalette } from '@/app/(revue)/_lib/revueTheme'
import { afterEach, describe, expect, test } from '@jest/globals'

const revueAdmin = Session.fromJsObject({ user: null, permissions: ['REVUE_ADMIN'], memberships: [] })

function createRevue(year: number, name: string, palette = defaultRevuePalette) {
    return revueOperations.create({ data: { year, name, ...palette }, session: revueAdmin })
}

function createGroup(revueId: number, name: string) {
    return revueGroupOperations.create({ params: { revueId }, data: { name }, session: revueAdmin })
}

afterEach(async () => {
    const revues = await prisma.revue.findMany({ select: { id: true } })
    await Promise.all(revues.map(revue => revueOperations.destroy({
        params: { revueId: revue.id },
        session: revueAdmin,
    })))
})

describe('revues', () => {
    test('only a revue admin creates one', async () => {
        await expect(revueOperations.create({
            data: { year: 2026, name: 'Revyen', ...defaultRevuePalette },
            session: Session.empty(),
        })).rejects.toThrow(Smorekopp)
    })

    test('anyone reads them, the newest first', async () => {
        await createRevue(2024, 'Eldst')
        await createRevue(2026, 'Nyest')
        await createRevue(2025, 'Midterst')

        const revues = await revueOperations.readMany({ session: Session.empty() })
        expect(revues.map(revue => revue.year)).toEqual([2026, 2025, 2024])
    })

    test('the year and the name are each unique', async () => {
        await createRevue(2026, 'Revyen')
        await expect(createRevue(2026, 'En annen')).rejects.toThrow(Smorekopp)
        await expect(createRevue(2025, 'Revyen')).rejects.toThrow(Smorekopp)
    })

    test('renaming a revue renames its article', async () => {
        const { id: revueId } = await createRevue(2026, 'Revyen')
        await revueOperations.update({ params: { revueId }, data: { name: 'Nytt navn' }, session: revueAdmin })

        const revue = await revueOperations.read({ params: { year: 2026 }, session: Session.empty() })
        expect(revue.name).toBe('Nytt navn')
        expect(revue.article.name).toBe('Nytt navn')
    })

    test('renaming the article of a revue renames the revue', async () => {
        const { id: revueId, articleId } = await createRevue(2026, 'Revyen')
        await revueOperations.article.update({
            implementationParams: { revueId },
            params: { articleId },
            data: { name: 'Fra artikkelen' },
            session: revueAdmin,
        })

        const revue = await revueOperations.read({ params: { year: 2026 }, session: Session.empty() })
        expect(revue.name).toBe('Fra artikkelen')
    })

    test('changing the year of a revue leaves its name', async () => {
        const { id: revueId } = await createRevue(2026, 'Revyen')
        const updated = await revueOperations.update({ params: { revueId }, data: { year: 2027 }, session: revueAdmin })
        expect(updated).toMatchObject({ year: 2027, name: 'Revyen' })
    })

    test('destroying a revue takes its article, groups, sections and members with it', async () => {
        const revue = await createRevue(2026, 'Revyen')
        const group = await createGroup(revue.id, 'Band')
        await revueGroupMemberOperations.create({
            params: { groupId: group.id },
            data: { type: 'DETAILS', name: 'Kari Nordmann' },
            session: revueAdmin,
        })

        await revueOperations.destroy({ params: { revueId: revue.id }, session: revueAdmin })

        expect(await prisma.article.findUnique({ where: { id: revue.articleId } })).toBeNull()
        expect(await prisma.articleSection.findUnique({ where: { id: group.articleSectionId } })).toBeNull()
        expect(await prisma.revueGroup.count()).toBe(0)
        expect(await prisma.revueGroupMember.count()).toBe(0)
    })
})

describe('the palette of a revue', () => {
    const palette = {
        themeBackground: '#f6efe3',
        themePrimary: '#8a3b12',
        themeSecondary: '#d9b98c',
        themeAccent: '#1f6f78',
    }

    test('is needed to create one', async () => {
        const formWithoutAccent = new FormData()
        formWithoutAccent.set('year', '2026')
        formWithoutAccent.set('name', 'Revyen')
        formWithoutAccent.set('themeBackground', palette.themeBackground)
        formWithoutAccent.set('themePrimary', palette.themePrimary)
        formWithoutAccent.set('themeSecondary', palette.themeSecondary)
        await expect(revueOperations.create({ data: formWithoutAccent, session: revueAdmin })).rejects.toThrow(Smorekopp)

        formWithoutAccent.set('themeAccent', palette.themeAccent)
        const created = await revueOperations.create({ data: formWithoutAccent, session: revueAdmin })
        expect(created).toMatchObject(palette)
    })

    test.each(['#fff', 'red', '#12345g', '#1234567', 'rgb(0, 0, 0)'])('refuses %s, which is not #rrggbb', async color => {
        await expect(createRevue(2026, 'Revyen', { ...palette, themePrimary: color })).rejects.toThrow(Smorekopp)
        const { id: revueId } = await createRevue(2025, 'Gyldig')
        await expect(revueOperations.update({
            params: { revueId },
            data: { themeBackground: color },
            session: revueAdmin,
        })).rejects.toThrow(Smorekopp)
    })

    test('is stored in lower case and read back by read and readMany', async () => {
        await createRevue(2026, 'Revyen', { ...palette, themeAccent: '#1F6F78' })

        const read = await revueOperations.read({ params: { year: 2026 }, session: Session.empty() })
        expect(read).toMatchObject(palette)
        const [first] = await revueOperations.readMany({ session: Session.empty() })
        expect(first).toMatchObject(palette)
    })

    test('changes on update, and is left alone where update does not give it', async () => {
        const { id: revueId } = await createRevue(2026, 'Revyen')
        await revueOperations.update({
            params: { revueId },
            data: { themeBackground: '#ffffff', themeAccent: '#000000' },
            session: revueAdmin,
        })
        await revueOperations.update({ params: { revueId }, data: { name: 'Nytt navn' }, session: revueAdmin })

        const read = await revueOperations.read({ params: { year: 2026 }, session: Session.empty() })
        expect(read).toMatchObject({
            ...defaultRevuePalette,
            themeBackground: '#ffffff',
            themeAccent: '#000000',
        })
    })
})

describe('revue groups', () => {
    test('are read by the year of the revue and their name', async () => {
        const first = await createRevue(2025, 'Første')
        const second = await createRevue(2026, 'Andre')
        await createGroup(first.id, 'Band')
        const group = await createGroup(second.id, 'Band')

        const read = await revueGroupOperations.read({ params: { year: 2026, name: 'Band' }, session: Session.empty() })
        expect(read.id).toBe(group.id)
        expect(read.revue.year).toBe(2026)
    })

    test('have a unique name within their revue', async () => {
        const { id: revueId } = await createRevue(2026, 'Revyen')
        await createGroup(revueId, 'Band')
        await expect(createGroup(revueId, 'Band')).rejects.toThrow(Smorekopp)
    })
})

describe('revue group members', () => {
    async function createGroupInRevue() {
        const { id: revueId } = await createRevue(2026, 'Revyen')
        return (await createGroup(revueId, 'Band')).id
    }

    async function createUser() {
        return prisma.user.create({
            data: {
                username: `revue${Date.now()}`,
                email: `revue${Date.now()}@example.com`,
                firstname: 'Kari',
                lastname: 'Nordmann',
                bioParagraph: { create: { name: `revueBio${Date.now()}` } },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
    }

    async function readMembers() {
        const group = await revueGroupOperations.read({ params: { year: 2026, name: 'Band' }, session: Session.empty() })
        return group.members
    }

    test('of type DETAILS need a name and of type USER need a user', async () => {
        const groupId = await createGroupInRevue()
        await expect(revueGroupMemberOperations.create({
            params: { groupId },
            data: { type: 'DETAILS', name: '  ' },
            session: revueAdmin,
        })).rejects.toThrow(Smorekopp)
        await expect(revueGroupMemberOperations.create({
            params: { groupId },
            data: { type: 'USER', userId: 0 },
            session: revueAdmin,
        })).rejects.toThrow(Smorekopp)
    })

    test('of type USER are read with the current name of the user, sorted among the others', async () => {
        const groupId = await createGroupInRevue()
        const user = await createUser()
        await revueGroupMemberOperations.create({
            params: { groupId },
            data: { type: 'USER', userId: user.id },
            session: revueAdmin,
        })
        await revueGroupMemberOperations.create({
            params: { groupId },
            data: { type: 'DETAILS', name: 'Lise Lydsen' },
            session: revueAdmin,
        })
        expect((await readMembers()).map(member => member.name)).toEqual(['Kari Nordmann', 'Lise Lydsen'])

        await prisma.user.update({ where: { id: user.id }, data: { firstname: 'Marit' } })
        expect((await readMembers()).map(member => member.name)).toEqual(['Lise Lydsen', 'Marit Nordmann'])

        await prisma.user.delete({ where: { id: user.id } })
    })

    test('are removed when their user is deleted', async () => {
        const groupId = await createGroupInRevue()
        const user = await createUser()
        await revueGroupMemberOperations.create({
            params: { groupId },
            data: { type: 'USER', userId: user.id },
            session: revueAdmin,
        })

        await prisma.user.delete({ where: { id: user.id } })
        expect(await readMembers()).toEqual([])
    })

    test('keep only what their type uses when the type changes', async () => {
        const groupId = await createGroupInRevue()
        const user = await createUser()
        const member = await revueGroupMemberOperations.create({
            params: { groupId },
            data: { type: 'USER', userId: user.id },
            session: revueAdmin,
        })
        expect(member.name).toBeNull()

        const details = await revueGroupMemberOperations.update({
            params: { memberId: member.id },
            data: { type: 'DETAILS', name: 'Scenenavn' },
            session: revueAdmin,
        })
        expect(details.name).toBe('Scenenavn')
        expect(details.userId).toBeNull()

        const backToUser = await revueGroupMemberOperations.update({
            params: { memberId: member.id },
            data: { type: 'USER', userId: user.id },
            session: revueAdmin,
        })
        expect(backToUser.name).toBeNull()
        expect(backToUser.userId).toBe(user.id)

        await prisma.user.delete({ where: { id: user.id } })
    })
})
