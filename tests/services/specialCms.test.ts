import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { frontpageOperations } from '@/services/frontpage/operations'
import { reportOperations } from '@/services/report/operations'
import { newStudentOperations } from '@/services/newStudent/operations'
import { editorContentToMarkdown } from '@/lib/markdown/editorMarkdown'
import { paragraphMarkdownLimits } from '@/services/cms/paragraphs/constants'
import { describe, expect, test } from '@jest/globals'
import type { JSONContent } from '@tiptap/react'

/**
 * The special paragraphs, cms images and links a service owns come from the implementSpecialCms
 * factories. The frontpage stands in for every owner here: it owns four of each kind.
 */

const visitor = Session.fromJsObject({ user: null, permissions: [], memberships: [] })
const admin = Session.fromJsObject({ user: null, permissions: ['FRONTPAGE_ADMIN'], memberships: [] })

describe('special cms parts of an owner', () => {
    test('a special paragraph is created when it is first read', async () => {
        await prisma.cmsParagraph.deleteMany({ where: { special: 'FRONTPAGE_1' } })

        const paragraph = await frontpageOperations.cmsParagraphs.read({
            params: { special: 'FRONTPAGE_1' },
            session: visitor,
        })

        expect(paragraph.special).toBe('FRONTPAGE_1')
        expect(await prisma.cmsParagraph.count({ where: { special: 'FRONTPAGE_1' } })).toBe(1)
    })

    test('a special that is not the owner\'s is refused, whoever asks', async () => {
        await expect(frontpageOperations.cmsParagraphs.read({
            params: { special: 'CABIN_CONTRACT' },
            session: admin,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })

        await expect(frontpageOperations.cmsParagraphs.internal.read.internalCall({
            params: { special: 'CABIN_CONTRACT' },
        })).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
    })

    test('the owner\'s paragraph is updated by who the update rule lets', async () => {
        const paragraph = await frontpageOperations.cmsParagraphs.internal.read.internalCall({
            params: { special: 'FRONTPAGE_2' },
        })

        await expect(frontpageOperations.cmsParagraphs.updateContent({
            params: { paragraphId: paragraph.id },
            data: { markdown: 'nope' },
            session: visitor,
        })).rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })

        const updated = await frontpageOperations.cmsParagraphs.updateContent({
            params: { paragraphId: paragraph.id },
            data: { markdown: '# Hei' },
            session: admin,
        })
        expect(updated.contentMd).toBe('# Hei')
        expect(updated.contentHtml).toBe('\n<h1>Hei</h1>\n')
    })

    test('a paragraph keeps the markdown as it was sent, and only the html the server makes of it', async () => {
        const paragraph = await frontpageOperations.cmsParagraphs.internal.read.internalCall({
            params: { special: 'FRONTPAGE_2' },
        })
        const markdown = 'Hei <b onclick="alert(1)">der</b>\n\n<script>alert(1)</script>\n\n[klikk](javascript:alert(1))  '

        const updated = await frontpageOperations.cmsParagraphs.updateContent({
            params: { paragraphId: paragraph.id },
            data: { markdown },
            session: admin,
        })

        expect(updated.contentMd).toBe(markdown)
        expect(updated.contentHtml).toBe('\n<p>Hei der</p>\n<p><a>klikk</a></p>\n')
    })

    test('a markdown whose html would be too large is refused, and nothing is stored', async () => {
        const paragraph = await frontpageOperations.cmsParagraphs.internal.read.internalCall({
            params: { special: 'FRONTPAGE_2' },
        })
        const before = await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: paragraph.id } })
        const markdown = `[a]: https://omega.ntnu.no/${'a'.repeat(10_000)}\n\n${'[a] '.repeat(1_000)}`

        await expect(frontpageOperations.cmsParagraphs.updateContent({
            params: { paragraphId: paragraph.id },
            data: { markdown },
            session: admin,
        })).rejects.toMatchObject({
            errorCode: 'BAD PARAMETERS',
            errors: [{ message: 'Avsnittet blir for stort. Del det opp, eller bruk færre lenker.' }],
        })
        expect(await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: paragraph.id } })).toEqual(before)
    })

    test('a markdown over a limit of what it costs to render is refused, in words, and nothing is stored', async () => {
        const paragraph = await frontpageOperations.cmsParagraphs.internal.read.internalCall({
            params: { special: 'FRONTPAGE_2' },
        })
        const before = await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: paragraph.id } })

        await expect(frontpageOperations.cmsParagraphs.updateContent({
            params: { paragraphId: paragraph.id },
            data: { markdown: `> x\n${'a\n'.repeat(paragraphMarkdownLimits.linesInBlock)}` },
            session: admin,
        })).rejects.toMatchObject({
            errorCode: 'BAD DATA',
            parseError: { error: { issues: [{ message: expect.stringContaining('avslutt listen og begynn en ny') }] } },
        })
        expect(await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: paragraph.id } })).toEqual(before)
    })

    test('what the editor sends for each of its tools is rendered as the html the page styles', async () => {
        const paragraph = await frontpageOperations.cmsParagraphs.internal.read.internalCall({
            params: { special: 'FRONTPAGE_2' },
        })
        const text = (value: string, marks: JSONContent['marks'] = []) => ({ type: 'text', text: value, marks })
        const paragraphOf = (...content: JSONContent[]) => ({ type: 'paragraph', content })
        const listItem = (value: string) => ({ type: 'listItem', content: [paragraphOf(text(value))] })
        const markdown = editorContentToMarkdown({
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 2 }, content: [text('Overskrift')] },
                paragraphOf(
                    text('fet', [{ type: 'bold' }]),
                    text(' og '),
                    text('kursiv', [{ type: 'italic' }]),
                    text(' og '),
                    text('lenke', [{ type: 'link', attrs: { href: 'https://omega.ntnu.no' } }]),
                    text(' og '),
                    text('strøket', [{ type: 'strike' }]),
                ),
                { type: 'bulletList', content: [listItem('punkt')] },
                { type: 'orderedList', attrs: { start: 1 }, content: [listItem('nummer')] },
                { type: 'blockquote', content: [paragraphOf(text('sitat'))] },
            ],
        })

        const updated = await frontpageOperations.cmsParagraphs.updateContent({
            params: { paragraphId: paragraph.id },
            data: { markdown },
            session: admin,
        })

        expect(updated.contentHtml).toBe([
            '',
            '<h2>Overskrift</h2>',
            '<p><strong>fet</strong> og <em>kursiv</em> og <a href="https://omega.ntnu.no">lenke</a> og '
                + '<del>strøket</del></p>',
            '<ul>',
            '  <li>punkt</li>',
            '</ul>',
            '<ol>',
            '  <li>nummer</li>',
            '</ol>',
            '<blockquote>',
            '  <p>sitat</p>',
            '</blockquote>',
            '',
        ].join('\n'))
    })

    test('a paragraph of another owner cannot be updated through this one', async () => {
        const contract = await prisma.cmsParagraph.upsert({
            where: { special: 'CABIN_CONTRACT' },
            create: { special: 'CABIN_CONTRACT' },
            update: {},
        })
        const plain = await prisma.cmsParagraph.create({ data: {} })

        for (const paragraphId of [contract.id, plain.id]) {
            await expect(frontpageOperations.cmsParagraphs.updateContent({
                params: { paragraphId },
                data: { markdown: 'taken over' },
                session: admin,
            })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
        }
    })

    test('cms images and links follow the same ownership', async () => {
        const image = await frontpageOperations.cmsImages.read({ params: { special: 'FRONTPAGE_3' }, session: visitor })
        const link = await frontpageOperations.cmsLinks.read({ params: { special: 'FRONTPAGE_3' }, session: visitor })

        await expect(frontpageOperations.cmsImages.update({
            params: { cmsImageId: image.id },
            data: { name: 'nytt navn' },
            session: admin,
        })).resolves.toMatchObject({ name: 'nytt navn' })
        await expect(frontpageOperations.cmsLinks.update({
            params: { linkId: link.id },
            data: { text: 'Les mer' },
            session: admin,
        })).resolves.toMatchObject({ text: 'Les mer' })

        const foreignImage = await prisma.cmsImage.upsert({
            where: { special: 'CAREER_ABOUT' },
            create: { special: 'CAREER_ABOUT' },
            update: {},
        })
        const foreignLink = await prisma.cmsLink.upsert({
            where: { special: 'CAREER_CONTACT' },
            create: { special: 'CAREER_CONTACT', text: 'Kontakt', url: './' },
            update: {},
        })
        await expect(frontpageOperations.cmsImages.update({
            params: { cmsImageId: foreignImage.id },
            data: { name: 'taken over' },
            session: admin,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
        await expect(frontpageOperations.cmsLinks.update({
            params: { linkId: foreignLink.id },
            data: { text: 'taken over' },
            session: admin,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
    })
})

describe('the special article of an owner', () => {
    const user = Session.fromJsObject({ user: null, permissions: ['REPORT_ADMIN'], memberships: [] })

    test('the article is read by who the read rule lets, and internally by the owner', async () => {
        await expect(newStudentOperations.read({ session: visitor })).resolves.toMatchObject({
            special: newStudentOperations.special,
        })
        const article = await reportOperations.internal.read.internalCall({})
        expect(article.special).toBe('REPORT_PAGE')
    })

    test('the update operations only reach the owner\'s own article', async () => {
        const report = await reportOperations.internal.read.internalCall({})
        const newStudent = await newStudentOperations.internal.read.internalCall({})

        await expect(reportOperations.update.update({
            implementationParams: undefined,
            params: { articleId: report.id },
            data: { name: 'Varsling' },
            session: user,
        })).resolves.toMatchObject({ name: 'Varsling' })

        await expect(reportOperations.update.update({
            implementationParams: undefined,
            params: { articleId: newStudent.id },
            data: { name: 'taken over' },
            session: user,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
    })
})
