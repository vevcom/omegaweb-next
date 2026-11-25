import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { frontpageOperations } from '@/services/frontpage/operations'
import { reportOperations } from '@/services/report/operations'
import { newStudentOperations } from '@/services/newStudent/operations'
import { describe, expect, test } from '@jest/globals'

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
