import { prisma } from '@/prisma-pn-client-instance'
import { articleOperations } from '@/cms/articles/operations'
import { describe, expect, test } from '@jest/globals'

describe('reordering the sections of an article', () => {
    test('the sections take the order given, and one that leaves a section out is refused', async () => {
        const article = await prisma.article.create({
            data: {
                name: 'Rekkefølge',
                coverImage: { create: {} },
                articleSections: { create: [{}, {}, {}] },
            },
            include: { articleSections: { orderBy: { order: 'asc' } } },
        })
        const [first, second, third] = article.articleSections.map(section => section.id)

        await articleOperations.reorderSections.internalCall({
            params: { articleId: article.id },
            data: { sectionIds: [third, first, second] },
        })

        const reordered = await prisma.articleSection.findMany({
            where: { articleId: article.id },
            orderBy: { order: 'asc' },
        })
        expect(reordered.map(section => section.id)).toEqual([third, first, second])

        await expect(articleOperations.reorderSections.internalCall({
            params: { articleId: article.id },
            data: { sectionIds: [first, first, second] },
        })).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
    })

    test('a new section goes where it is asked to, and last when nothing is asked', async () => {
        const article = await prisma.article.create({
            data: { name: 'Innsetting', coverImage: { create: {} }, articleSections: { create: [{}, {}] } },
            include: { articleSections: { orderBy: { order: 'asc' } } },
        })
        const [first, second] = article.articleSections.map(section => section.id)
        const add = async (afterSectionId?: number | null) => {
            const updated = await articleOperations.addSection.internalCall({
                params: { articleId: article.id },
                data: { includeParts: { cmsParagraph: true }, afterSectionId },
            })
            return updated.articleSections.toSorted((one, other) => one.order - other.order).map(section => section.id)
        }

        const afterFirst = await add(first)
        const inserted = afterFirst[1]
        expect(afterFirst).toEqual([first, inserted, second])

        const atStart = await add(null)
        expect(atStart.slice(1)).toEqual([first, inserted, second])

        const atEnd = await add()
        expect(atEnd.slice(0, 4)).toEqual(atStart)

        await expect(add(-1)).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
    })
})
