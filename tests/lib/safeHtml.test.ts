import { markdownToSafeHtml } from '@/lib/html/safeHtml'
import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { describe, expect, test } from '@jest/globals'

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
