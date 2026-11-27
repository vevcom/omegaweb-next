import { HtmlTooLongError, htmlLengthAtLeast, markdownToSafeHtml } from '@/lib/html/safeHtml'
import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { describe, expect, test } from '@jest/globals'
import { fromMarkdown } from 'mdast-util-from-markdown'

// Everything a CMS editor or notification author could use to get script into a page or an email.
const dangerousMarkdown = {
    rawScript: '<script>alert(1)</script>',
    rawImgOnerror: '<img src=x onerror=alert(1)>',
    rawIframe: '<iframe src="https://evil.example"></iframe>',
    rawForm: '<form action="https://evil.example"><input name="password"></form>',
    javascriptLink: '[klikk](javascript:alert(document.cookie))',
    entityEncodedJavascriptLink: '[klikk](jav&#x61;script:alert(1))',
    javascriptAutolink: '<javascript:alert(1)>',
    javascriptReferenceLink: '[klikk][a]\n\n[a]: javascript:alert(1)',
    dataLink: '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    javascriptImage: '![x](javascript:alert(1))',
}

const dangerousHtml = {
    script: '<p>hei</p><script>alert(1)</script>',
    eventHandler: '<p onclick="alert(1)">hei</p><img src="x" onerror="alert(1)">',
    javascriptLink: '<a href="javascript:alert(1)">klikk</a>',
    iframe: '<iframe src="https://evil.example"></iframe>',
    style: '<style>body { display: none }</style>',
}

function expectNothingExecutable(html: string) {
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<iframe/i)
    expect(html).not.toMatch(/<form/i)
    expect(html).not.toMatch(/<style/i)
    expect(html).not.toMatch(/\son\w+=/i)
    expect(html).not.toMatch(/(href|src)="\s*(javascript|data|vbscript):/i)
}

describe('markdownToSafeHtml', () => {
    test.each(Object.entries(dangerousMarkdown))('neutralizes %s', async (_, markdown) => {
        expectNothingExecutable(await markdownToSafeHtml(markdown))
    })

    test('keeps ordinary markdown', async () => {
        const html = await markdownToSafeHtml('# Tittel\n\n**fet** og [lenke](https://omega.ntnu.no)')
        expect(html).toContain('<h1>Tittel</h1>')
        expect(html).toContain('<strong>fet</strong>')
        expect(html).toContain('<a href="https://omega.ntnu.no">lenke</a>')
    })

    test.each(Object.entries(dangerousMarkdown))('neutralizes %s with gfm', async (_, markdown) => {
        expectNothingExecutable(await markdownToSafeHtml(markdown, { gfm: true }))
    })

    test('renders strikethrough with gfm', async () => {
        expect(await markdownToSafeHtml('~~avlyst~~', { gfm: true })).toContain('<del>avlyst</del>')
    })

    test('renders tables with gfm', async () => {
        const html = await markdownToSafeHtml('| Dag | Tid |\n| --- | --- |\n| Fredag | 18:00 |', { gfm: true })
        expect(html).toContain('<table>')
        expect(html).toContain('<th>Dag</th>')
        expect(html).toContain('<td>Fredag</td>')
    })

    test('leaves gfm syntax as text without gfm', async () => {
        expect(await markdownToSafeHtml('~~avlyst~~')).toContain('~~avlyst~~')
    })

    test('renders two tildes as strikethrough and leaves one as text with strikethrough', async () => {
        expect(await markdownToSafeHtml('~~avlyst~~', { strikethrough: true })).toContain('<del>avlyst</del>')
        expect(await markdownToSafeHtml('Kl. 18~20 og 21~22', { strikethrough: true }))
            .toBe('\n<p>Kl. 18~20 og 21~22</p>\n')
    })

    test('refuses a markdown made to grow from the parsed markdown, before any html is made of it', async () => {
        // The sanitizer drops these addresses, so the html written would be short. It is never written.
        const markdown = `[a]: javascript:${'a'.repeat(2_000)}\n\n${'[a] '.repeat(1_000)}`
        await expect(markdownToSafeHtml(markdown, { maxLength: 1_000_000 })).rejects.toBeInstanceOf(HtmlTooLongError)
    })

    test('refuses a markdown whose html is longer than the most once it is written', async () => {
        await expect(markdownToSafeHtml('&'.repeat(1_000), { maxLength: 3_000 })).rejects.toBeInstanceOf(HtmlTooLongError)
        expect(await markdownToSafeHtml('&'.repeat(400), { maxLength: 3_000 })).toHaveLength(2_409)
    })
})

describe('the measure of the html before it is made', () => {
    test('counts the titles of links, images and the definitions a reference uses', () => {
        const title = 't'.repeat(1_000)
        expect(htmlLengthAtLeast(fromMarkdown(`[a]: https://x.no "${title}"\n\n[a] [a] [a]`))).toBeGreaterThan(3 * 1_000)
        expect(htmlLengthAtLeast(fromMarkdown(`[a](https://x.no "${title}") ![b](https://x.no/b.png "${title}")`)))
            .toBeGreaterThan(2 * 1_000)
    })

    test('counts the first definition of a label, which is the one a reference uses', () => {
        const long = `https://x.no/${'x'.repeat(1_000)}`
        expect(htmlLengthAtLeast(fromMarkdown(`[a]: ${long}\n[a]: https://x.no\n\n[a]`))).toBeGreaterThan(1_000)
        expect(htmlLengthAtLeast(fromMarkdown(`[a]: https://x.no\n[a]: ${long}\n\n[a]`))).toBeLessThan(100)
    })

    test('counts two spaces of indentation for every list, item and quote around a list, an item or a quote', () => {
        // Quotes at 0, 2 and 4, the list at 6, the item at 8, and the text.
        expect(htmlLengthAtLeast(fromMarkdown('> > > - a'))).toBe(0 + 2 + 4 + 6 + 8 + 1)
    })

    test.each([
        ['prose', 'Omega har egen hytte, se [her](https://omega.ntnu.no "Hytta") og ![logo](https://x.no/a.png "Logo").'],
        ['nested lists and quotes', '> - a\n>   - b\n>     > c\n>     > - d\n\n1. x\n   1. y\n      > z'],
        ['references with titles', '[a]: https://x.no "tittel"\n\n[a] og [a] og ![b][a]'],
        ['code', '```\n  <kode> & mer\n```\n\n    innrykket'],
    ])('refuses nothing whose html is within the most, here for %s', async (_name, markdown) => {
        const html = await markdownToSafeHtml(markdown, { strikethrough: true })
        await expect(markdownToSafeHtml(markdown, { strikethrough: true, maxLength: html.length })).resolves.toBe(html)
    })
})

describe('sanitizeHtml', () => {
    test.each(Object.entries(dangerousHtml))('neutralizes %s', (_, html) => {
        expectNothingExecutable(sanitizeHtml(html))
    })

    test('keeps ordinary html', () => {
        expect(sanitizeHtml('<p><em>hei</em> <a href="https://omega.ntnu.no">lenke</a></p>'))
            .toBe('<p><em>hei</em> <a href="https://omega.ntnu.no">lenke</a></p>')
    })
})
