import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { revueOperations } from '@/services/revue/operations'
import { defaultRevuePalette } from '@/app/(revue)/_lib/revueTheme'
import { afterEach, describe, expect, test } from '@jest/globals'

const revueAdmin = Session.fromJsObject({ user: null, permissions: ['REVUE_ADMIN'], memberships: [] })

function createRevue(year: number, name: string, palette = defaultRevuePalette) {
    return revueOperations.create({ data: { year, name, ...palette }, session: revueAdmin })
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

    test('destroying a revue takes its article with it', async () => {
        const revue = await createRevue(2026, 'Revyen')

        await revueOperations.destroy({ params: { revueId: revue.id }, session: revueAdmin })

        expect(await prisma.article.findUnique({ where: { id: revue.articleId } })).toBeNull()
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
