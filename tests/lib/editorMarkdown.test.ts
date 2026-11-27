import { editorContentToMarkdown, markdownToEditorContent, paragraphEditorContent } from '@/lib/markdown/editorMarkdown'
import { describe, expect, test } from '@jest/globals'
import { getSchema } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/react'

// The schema of the paragraph editor, which a document made from markdown must fit.
const schema = getSchema([StarterKit.configure({ underline: false, link: { openOnClick: false } })])

const text = (value: string, ...marks: NonNullable<JSONContent['marks']>) => (
    marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value }
)
const paragraph = (...content: JSONContent[]) => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' })
const document = (...content: JSONContent[]) => ({ type: 'doc', content })
const listItem = (...content: JSONContent[]) => ({ type: 'listItem', content })
const bold = { type: 'bold' }
const lineBreak = { type: 'hardBreak' }
const heading = (...content: JSONContent[]) => ({ type: 'heading', attrs: { level: 2 }, content })
const bulletList = (...items: JSONContent[]) => ({ type: 'bulletList', content: items })
const link = (href: string) => ({ type: 'link', attrs: { href } })

/**
 * What a user makes in the editor, and the markdown it is stored as. Each is stored, read back into the
 * editor and stored again, which must give the same document and the same markdown.
 */
const typed: [string, JSONContent, string][] = [
    ['bold', document(paragraph(text('a '), text('fet', bold), text(' ord'))), 'a **fet** ord'],
    ['italic', document(paragraph(text('kursiv', { type: 'italic' }))), '*kursiv*'],
    ['a heading', document({ type: 'heading', attrs: { level: 2 }, content: [text('Tittel')] }, paragraph(text('tekst'))),
        '## Tittel\n\ntekst'],
    ['a link', document(paragraph(text('les '), text('her', link('https://omega.ntnu.no/a_b?x=1&y=2')))),
        'les [her](https://omega.ntnu.no/a_b?x=1\\&y=2)'],
    ['a bullet list', document({
        type: 'bulletList',
        content: [listItem(paragraph(text('en'))), listItem(paragraph(text('to')))],
    }), '- en\n- to'],
    ['a numbered list', document({ type: 'orderedList', attrs: { start: 3 }, content: [listItem(paragraph(text('tre')))] }),
        '3. tre'],
    ['a quote', document({ type: 'blockquote', content: [paragraph(text('sitat')), paragraph(text('mer'))] }),
        '> sitat\n>\n> mer'],
    ['inline code', document(paragraph(text('kjør '), text('npm *test*', { type: 'code' }))), 'kjør `npm *test*`'],
    ['a code block', document({
        type: 'codeBlock',
        attrs: { language: null },
        content: [text('# ikke tittel\n```\n  *x*')],
    }), '````\n# ikke tittel\n```\n  *x*\n````'],
    ['a horizontal rule', document(paragraph(text('a')), { type: 'horizontalRule' }, paragraph(text('b'))), 'a\n\n---\n\nb'],
    ['a hard line break', document(paragraph(text('en'), { type: 'hardBreak' }, text('# to'))), 'en\\\n\\# to'],
    ['strike-through', document(paragraph(text('strøket', { type: 'strike' }))), '~~strøket~~'],
    ['a literal * and _', document(paragraph(text('* 2*3*4 og snake_case_'))), '\\* 2\\*3\\*4 og snake_case\\_'],
    ['a literal # at the start of a line', document(paragraph(text('# ikke tittel'))), '\\# ikke tittel'],
    ['1. at the start of a line', document(paragraph(text('17. mai'))), '17\\. mai'],
    ['<b> typed as text', document(paragraph(text('<b>ikke fet</b> &amp;'))), '\\<b>ikke fet\\</b> \\&amp;'],
    ['a list inside a list', document({
        type: 'bulletList',
        content: [
            listItem(paragraph(text('en')), { type: 'bulletList', content: [listItem(paragraph(text('inni')))] }),
            listItem(paragraph(text('to'))),
        ],
    }), '- en\n  - inni\n- to'],
    ['a list item with two paragraphs', document({
        type: 'bulletList',
        content: [listItem(paragraph(text('første')), paragraph(text('andre'))), listItem(paragraph(text('neste')))],
    }), '- første\n\n  andre\n\n- neste'],
    ['a link around bold text', document(paragraph(text('fet lenke', link('https://omega.ntnu.no'), bold))),
        '[**fet lenke**](https://omega.ntnu.no)'],
    ['an empty document', document(paragraph()), ''],
]

describe('the markdown of the paragraph editor', () => {
    test.each(typed)('%s is stored as it was typed', (_name, typedDocument, markdown) => {
        expect(editorContentToMarkdown(typedDocument)).toBe(markdown)

        const readBack = markdownToEditorContent(markdown)
        const node = schema.nodeFromJSON(readBack)
        node.check()
        expect(node.toJSON()).toEqual(schema.nodeFromJSON(typedDocument).toJSON())
        expect(editorContentToMarkdown(readBack)).toBe(markdown)
    })

    // Markdown has no line break at the end of a block, so it would be stored as a backslash.
    test.each<[string, JSONContent, string, JSONContent]>([
        ['last in a paragraph', document(paragraph(text('en'), lineBreak)), 'en', document(paragraph(text('en')))],
        ['last in a heading', document(heading(text('Tittel'), lineBreak)), '## Tittel', document(heading(text('Tittel')))],
        ['last in a list item', document(bulletList(listItem(paragraph(text('en'), lineBreak)))), '- en',
            document(bulletList(listItem(paragraph(text('en')))))],
        ['alone in a paragraph', document(paragraph(text('a')), paragraph(lineBreak), paragraph(text('b'))),
            'a\n\nb', document(paragraph(text('a')), paragraph(text('b')))],
        ['twice last in a paragraph', document(paragraph(text('en'), lineBreak, lineBreak)), 'en',
            document(paragraph(text('en')))],
        ['alone in the last paragraph', document(paragraph(text('a')), paragraph(lineBreak)), 'a',
            document(paragraph(text('a')))],
    ])('a line break %s is not stored', (_name, typedDocument, markdown, readBack) => {
        expect(editorContentToMarkdown(typedDocument)).toBe(markdown)
        expect(markdownToEditorContent(markdown)).toEqual(readBack)
        expect(editorContentToMarkdown(readBack)).toBe(markdown)
    })

    test('a list item with nothing in it is not stored, so the item above it is read as it was typed', () => {
        const orderedList = (...items: JSONContent[]) => ({ type: 'orderedList', attrs: { start: 1 }, content: items })
        const stored = document(bulletList(listItem(paragraph(text('en')))))

        for (const emptyList of [bulletList(listItem(paragraph())), orderedList(listItem(paragraph()))]) {
            const markdown = editorContentToMarkdown(document(bulletList(listItem(paragraph(text('en')), emptyList))))
            expect(markdown).toBe('- en')
            expect(markdownToEditorContent(markdown)).toEqual(stored)
        }
        expect(editorContentToMarkdown(document(bulletList(
            listItem(paragraph(text('en'))), listItem(paragraph()), listItem(paragraph(text('tre'))),
        )))).toBe('- en\n- tre')
        expect(editorContentToMarkdown(document(bulletList(listItem(paragraph()))))).toBe('')
    })

    test('a mark it does not know leaves its text plain', () => {
        expect(editorContentToMarkdown(document(paragraph(
            text('understreket', { type: 'underline' }),
            text(' og '),
            text('fet', { type: 'underline' }, bold),
        )))).toBe('understreket og **fet**')
    })

    test('a block it does not know keeps what is in it, and one with nothing in it is not stored', () => {
        expect(editorContentToMarkdown(document(
            { type: 'callout', content: [text('tekst')] },
            { type: 'details', content: [paragraph(text('inni')), bulletList(listItem(paragraph(text('punkt'))))] },
            { type: 'image', attrs: { src: 'https://omega.ntnu.no/logo.png' } },
            paragraph(text('slutt')),
        ))).toBe('tekst\n\ninni\n\n- punkt\n\nslutt')
    })

    // Markdown has no empty paragraph, so blank lines are dropped as markdown drops them.
    test.each<[string, JSONContent, string, JSONContent]>([
        ['two blank lines', document(paragraph(text('a')), paragraph(), paragraph(), paragraph(text('b'))),
            'a\n\nb', document(paragraph(text('a')), paragraph(text('b')))],
        ['three blank lines', document(paragraph(text('a')), paragraph(), paragraph(), paragraph(), paragraph(text('b'))),
            'a\n\nb', document(paragraph(text('a')), paragraph(text('b')))],
        ['the empty paragraph the editor keeps last', document(heading(text('Tittel')), paragraph()), '## Tittel',
            document(heading(text('Tittel')))],
        ['a paragraph of spaces', document(paragraph(text('a')), paragraph(text('   ')), paragraph(text('b'))),
            'a\n\nb', document(paragraph(text('a')), paragraph(text('b')))],
        // As Word pastes an empty line, and as html imported from OmegaWeb Basic writes one.
        ['a paragraph of a no-break space', document(paragraph(text('a')), paragraph(text('\u00a0')), paragraph(text('b'))),
            'a\n\nb', document(paragraph(text('a')), paragraph(text('b')))],
        ['a paragraph of spaces, bold, and a line break',
            document(paragraph(text('a')), paragraph(text(' \u00a0', bold), lineBreak, text(' ')), paragraph(text('b'))),
            'a\n\nb', document(paragraph(text('a')), paragraph(text('b')))],
        ['a blank line in a list item', document(bulletList(
            listItem(paragraph(text('en')), paragraph()),
            listItem(paragraph(text('to'))),
        )), '- en\n- to', document(bulletList(listItem(paragraph(text('en'))), listItem(paragraph(text('to')))))],
    ])('%s is not stored', (_name, typedDocument, markdown, readBack) => {
        expect(editorContentToMarkdown(typedDocument)).toBe(markdown)
        expect(markdownToEditorContent(markdown)).toEqual(readBack)
        expect(editorContentToMarkdown(readBack)).toBe(markdown)
    })

    test('the editor starts from the markdown when there is some, and from the cleaned html otherwise', () => {
        const html = '<p onclick="alert(1)">importert</p>'
        expect(paragraphEditorContent({ contentMd: 'fra **markdown**', contentHtml: html }))
            .toEqual(document(paragraph(text('fra '), text('markdown', bold))))
        expect(paragraphEditorContent({ contentMd: ' \n\t', contentHtml: html })).toBe('<p>importert</p>')
    })

    test('markdown written by hand is read as the page shows it', () => {
        const readBack = markdownToEditorContent([
            'en linje\nfortsetter',
            '[lenke][omega] <b>rå html</b>',
            '- # tittel i en liste',
            'Kl. 18~20 og 21~22',
            '[omega]: https://omega.ntnu.no',
            '[Omega]: https://feil.no',
        ].join('\n\n'))

        schema.nodeFromJSON(readBack).check()
        expect(readBack).toEqual(document(
            paragraph(text('en linje fortsetter')),
            paragraph(text('lenke', link('https://omega.ntnu.no')), text(' '), text('rå html')),
            {
                type: 'bulletList',
                content: [listItem(paragraph(), {
                    type: 'heading',
                    attrs: { level: 1 },
                    content: [text('tittel i en liste')],
                })],
            },
            paragraph(text('Kl. 18~20 og 21~22')),
        ))
    })
})
