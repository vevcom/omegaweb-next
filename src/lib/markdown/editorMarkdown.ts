import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmStrikethroughFromMarkdown, gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough'
import type { JSONContent } from '@tiptap/react'
import type { CmsParagraph } from '@/prisma-generated-pn-types'
import type { BlockContent, ListItem, Nodes, PhrasingContent, RootContent } from 'mdast'

// The marks that wrap text, in the order they are nested, outermost first. Code is a leaf of markdown, so it is
// written apart from them.
const markOrder = ['link', 'bold', 'italic', 'strike']

// A single tilde is text, so a row written before strike-through was read keeps its tildes.
const strikethroughSyntax = { singleTilde: false }

type Mark = NonNullable<JSONContent['marks']>[number]
type Wrapper = Extract<PhrasingContent, { type: 'link' | 'strong' | 'emphasis' | 'delete' }>

/**
 * The rich text editor's document and the markdown a paragraph is stored as, each made from the other.
 * The markdown is CommonMark with GitHub's strikethrough, which says everything the editor can make,
 * and is what the server renders with `markdownToSafeHtml(markdown, { strikethrough: true })`.
 * Text is escaped where markdown would read it as syntax, so what was typed is stored as it was typed.
 * Markdown has no empty paragraph, so a blank line in the editor is not stored.
 */
export function markdownToEditorContent(markdown: string): JSONContent {
    const root = fromMarkdown(markdown, {
        extensions: [gfmStrikethrough(strikethroughSyntax)],
        mdastExtensions: [gfmStrikethroughFromMarkdown()],
    })
    const linkDefinitions = new Map<string, string>()
    collectLinkDefinitions(root, linkDefinitions)
    const content = blocksToEditor(root.children, linkDefinitions)
    return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

export function editorContentToMarkdown(document: JSONContent): string {
    return toMarkdown(
        { type: 'root', children: (document.content ?? []).flatMap(blockToMarkdown) },
        { extensions: [gfmStrikethroughToMarkdown()], bullet: '-', rule: '-' },
    ).replace(/\n$/, '')
}

/**
 * What the editor of a paragraph starts from: its markdown, or for a paragraph imported as html, which has none,
 * its html. That html never passed the sanitizer, so it is cleaned first. It is markdown from its first save.
 */
export function paragraphEditorContent(paragraph: Pick<CmsParagraph, 'contentMd' | 'contentHtml'>): JSONContent | string {
    return paragraph.contentMd.trim() ? markdownToEditorContent(paragraph.contentMd) : sanitizeHtml(paragraph.contentHtml)
}

function blocksToEditor(nodes: RootContent[], linkDefinitions: Map<string, string>): JSONContent[] {
    return nodes.flatMap((node): JSONContent[] => {
        switch (node.type) {
            case 'paragraph': {
                const content = inlineToEditor(node.children, [], linkDefinitions)
                return [content.length ? { type: 'paragraph', content } : { type: 'paragraph' }]
            }
            case 'heading':
                return [{
                    type: 'heading',
                    attrs: { level: node.depth },
                    content: inlineToEditor(node.children, [], linkDefinitions),
                }]
            case 'list': {
                const content = node.children.map(item => listItemToEditor(item, linkDefinitions))
                return [node.ordered
                    ? { type: 'orderedList', attrs: { start: node.start ?? 1 }, content }
                    : { type: 'bulletList', content }]
            }
            case 'blockquote': {
                const content = blocksToEditor(node.children, linkDefinitions)
                return [{ type: 'blockquote', content: content.length ? content : [{ type: 'paragraph' }] }]
            }
            case 'code':
                return [{
                    type: 'codeBlock',
                    attrs: { language: node.lang ?? null },
                    content: node.value ? [{ type: 'text', text: node.value }] : [],
                }]
            case 'thematicBreak':
                return [{ type: 'horizontalRule' }]
            // Raw html is dropped, as the server drops it, and the editor has no images or definitions.
            default:
                return []
        }
    })
}

function listItemToEditor(item: ListItem, linkDefinitions: Map<string, string>): JSONContent {
    const content = blocksToEditor(item.children, linkDefinitions)
    // An item of the editor starts with a paragraph.
    if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' })
    return { type: 'listItem', content }
}

function inlineToEditor(nodes: PhrasingContent[], marks: Mark[], linkDefinitions: Map<string, string>): JSONContent[] {
    return nodes.flatMap((node): JSONContent[] => {
        switch (node.type) {
            // A line ending inside a paragraph is shown as a space, so the editor shows it as one too.
            case 'text':
                return node.value ? [textToEditor(node.value.replace(/\n/g, ' '), marks)] : []
            case 'inlineCode':
                return [textToEditor(node.value, [...marks, { type: 'code' }])]
            case 'strong':
                return inlineToEditor(node.children, [...marks, { type: 'bold' }], linkDefinitions)
            case 'emphasis':
                return inlineToEditor(node.children, [...marks, { type: 'italic' }], linkDefinitions)
            case 'delete':
                return inlineToEditor(node.children, [...marks, { type: 'strike' }], linkDefinitions)
            case 'link':
                return inlineToEditor(node.children, [...marks, linkMark(node.url)], linkDefinitions)
            case 'linkReference': {
                const href = linkDefinitions.get(node.identifier)
                const withLink = href === undefined ? marks : [...marks, linkMark(href)]
                return inlineToEditor(node.children, withLink, linkDefinitions)
            }
            case 'break':
                return [{ type: 'hardBreak' }]
            default:
                return []
        }
    })
}

function linkMark(href: string): Mark {
    return { type: 'link', attrs: { href } }
}

function textToEditor(text: string, marks: Mark[]): JSONContent {
    return marks.length ? { type: 'text', text, marks } : { type: 'text', text }
}

// The first definition of a label is the one markdown uses.
function collectLinkDefinitions(node: Nodes, linkDefinitions: Map<string, string>) {
    if (node.type === 'definition' && !linkDefinitions.has(node.identifier)) linkDefinitions.set(node.identifier, node.url)
    if ('children' in node) node.children.forEach(child => collectLinkDefinitions(child, linkDefinitions))
}

function blockToMarkdown(block: JSONContent): BlockContent[] {
    const content = block.content ?? []
    switch (block.type) {
        case 'paragraph':
            return paragraphToMarkdown(content)
        case 'heading':
            return [{ type: 'heading', depth: headingDepth(block.attrs?.level), children: inlineToMarkdown(content) }]
        case 'bulletList':
        case 'orderedList': {
            // An item with nothing in it is a bare marker, which under a paragraph reads as something else:
            // `-` as the underline of a heading, and `1.` as text. So it is not stored, as an empty paragraph is not.
            const items = content.map(listItemToMarkdown).filter(item => item.children.length)
            if (!items.length) return []
            const ordered = block.type === 'orderedList'
            return [{
                type: 'list',
                ordered,
                start: ordered ? numberOr(block.attrs?.start, 1) : undefined,
                spread: items.some(item => item.spread),
                children: items,
            }]
        }
        case 'blockquote':
            return [{ type: 'blockquote', children: content.flatMap(blockToMarkdown) }]
        case 'codeBlock':
            return [{
                type: 'code',
                lang: typeof block.attrs?.language === 'string' ? block.attrs.language : null,
                value: content.map(text => text.text ?? '').join(''),
            }]
        case 'horizontalRule':
            return [{ type: 'thematicBreak' }]
        // A block the editor has and this does not know keeps what is in it: its text as a paragraph, or its
        // blocks in its place. One with nothing in it, such as an image, is not stored.
        default:
            if (!content.length) return []
            return content.every(isInline) ? paragraphToMarkdown(content) : content.flatMap(blockToMarkdown)
    }
}

// A paragraph of nothing but whitespace, no-break spaces among it, is a blank line and is not stored either.
function paragraphToMarkdown(content: JSONContent[]): BlockContent[] {
    if (content.every(node => node.type === 'hardBreak' || !node.text?.trim())) return []
    return [{ type: 'paragraph', children: inlineToMarkdown(content) }]
}

function listItemToMarkdown(item: JSONContent): ListItem {
    const children = (item.content ?? []).flatMap(blockToMarkdown)
    return {
        type: 'listItem',
        // A paragraph and the list under it need no blank line between them, anything else after the first does.
        spread: children.some((child, index) => index > 0 && child.type !== 'list'),
        children,
    }
}

/**
 * Nests the marks of a run of text nodes as markdown does, keeping a mark open over the nodes that share it,
 * so bold text with a link in it is one strong node around the link and not two. A mark this does not know
 * leaves its text plain.
 */
function inlineToMarkdown(nodes: JSONContent[]): PhrasingContent[] {
    const root: { children: PhrasingContent[] } = { children: [] }
    const open: { mark: Mark, node: Wrapper }[] = []
    const innermost = () => open.at(-1)?.node ?? root
    // Markdown has no line break at the end of a block: it would be stored as a backslash.
    const lastText = nodes.findLastIndex(node => node.type !== 'hardBreak')
    for (const node of nodes.slice(0, lastText + 1)) {
        const marks = [...node.marks ?? []]
            .filter(mark => markOrder.includes(mark.type))
            .sort((a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type))
        let kept = 0
        while (kept < marks.length && kept < open.length && sameMark(open[kept].mark, marks[kept])) kept++
        open.length = kept
        for (const mark of marks.slice(kept)) {
            const wrapper = markToMarkdown(mark)
            if (!wrapper) continue
            innermost().children.push(wrapper)
            open.push({ mark, node: wrapper })
        }
        if (node.type === 'hardBreak') {
            innermost().children.push({ type: 'break' })
        } else if (node.marks?.some(mark => mark.type === 'code')) {
            innermost().children.push({ type: 'inlineCode', value: node.text ?? '' })
        } else {
            innermost().children.push({ type: 'text', value: node.text ?? '' })
        }
    }
    return root.children
}

function markToMarkdown(mark: Mark): Wrapper | null {
    switch (mark.type) {
        case 'link':
            return { type: 'link', url: typeof mark.attrs?.href === 'string' ? mark.attrs.href : '', children: [] }
        case 'bold':
            return { type: 'strong', children: [] }
        case 'italic':
            return { type: 'emphasis', children: [] }
        case 'strike':
            return { type: 'delete', children: [] }
        default:
            return null
    }
}

function sameMark(a: Mark, b: Mark) {
    return a.type === b.type && (a.type !== 'link' || a.attrs?.href === b.attrs?.href)
}

function isInline(node: JSONContent) {
    return node.type === 'text' || node.type === 'hardBreak'
}

function headingDepth(level: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
    switch (level) {
        case 1: case 2: case 3: case 4: case 5: case 6:
            return level
        default:
            return 2
    }
}

function numberOr(value: unknown, fallback: number) {
    return typeof value === 'number' ? value : fallback
}
