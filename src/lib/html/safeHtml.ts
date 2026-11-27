import '@ow-server-only'
import rehypeFormat from 'rehype-format'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import type { Processor } from 'unified'
import type { Nodes, Root } from 'mdast'

/** The html of a markdown would be longer than the `maxLength` it was rendered with. */
export class HtmlTooLongError extends Error {
    constructor(maxLength: number) {
        super(`The html would be longer than ${maxLength} characters`)
    }
}

/**
 * Renders markdown to html that is safe to inject into a page or an email.
 *
 * Raw html in the markdown is dropped by remark-rehype, but markdown syntax alone still produces
 * dangerous html - `[x](javascript:...)` becomes a script-running link - so the tree is run through
 * rehype-sanitize's default (GitHub) schema, which only lets through whitelisted tags, attributes
 * and url protocols.
 *
 * `gfm` turns on GitHub flavored markdown - tables, strikethrough, task lists and bare links. It is
 * parsed before the sanitizing, so what it produces goes through the same schema. `strikethrough` turns on
 * GFM's strikethrough alone, with two tildes, which is the markdown of a CMS paragraph (`editorMarkdown.ts`).
 *
 * `maxLength` refuses with `HtmlTooLongError` a markdown whose html would be longer. A short markdown can make
 * a huge html, since a link definition used many times repeats its address and title, so the parsed markdown is measured
 * before any html is made of it, and the html once it is written.
 */
export async function markdownToSafeHtml(
    markdown: string,
    { gfm = false, strikethrough = false, maxLength = Infinity }: {
        gfm?: boolean,
        strikethrough?: boolean,
        maxLength?: number,
    } = {},
): Promise<string> {
    const html = (await unified()
        .use(remarkParse)
        .use(gfm ? [remarkGfm] : [])
        .use(strikethrough && !gfm ? [remarkStrikethrough] : [])
        .use(remarkRefuseHtmlLongerThan, maxLength)
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeFormat)
        .use(rehypeStringify)
        .process(markdown)).toString()
    if (html.length > maxLength) throw new HtmlTooLongError(maxLength)
    return html
}

function remarkStrikethrough(this: Processor) {
    const data = this.data()
    data.micromarkExtensions = [...data.micromarkExtensions ?? [], gfmStrikethrough({ singleTilde: false })]
    data.fromMarkdownExtensions = [...data.fromMarkdownExtensions ?? [], gfmStrikethroughFromMarkdown()]
}

// Without a `maxLength`, as for the mails, nothing is measured.
function remarkRefuseHtmlLongerThan(maxLength: number) {
    if (maxLength === Infinity) return undefined
    return (tree: Root) => {
        if (htmlLengthAtLeast(tree) > maxLength) throw new HtmlTooLongError(maxLength)
    }
}

/**
 * The characters of text, addresses and titles the html of a parsed markdown holds, and the indentation
 * rehype-format gives its lists and quotes. Its html is at least as long, but for what the sanitizer drops and the
 * runs of whitespace rehype-format collapses, which are few in what an author writes. A reference counts the
 * address and the title of its definition, the first of its label as markdown reads it. A list, an item or a quote
 * starts a line indented two spaces for each list, item and quote around it.
 */
export function htmlLengthAtLeast(tree: Root) {
    const nested = allNodes(tree)
    const nodes = nested.map(({ node }) => node)
    const definitions = new Map<string, number>()
    for (const node of nodes) {
        if (node.type !== 'definition' || definitions.has(node.identifier)) continue
        definitions.set(node.identifier, node.url.length + (node.title?.length ?? 0))
    }
    let length = 0
    for (const { node, containers } of nested) {
        if (isContainer(node)) length += 2 * containers
        switch (node.type) {
            case 'text':
            case 'inlineCode':
            case 'code':
                length += node.value.length
                break
            case 'link':
                length += node.url.length + (node.title?.length ?? 0)
                break
            case 'image':
                length += node.url.length + (node.alt?.length ?? 0) + (node.title?.length ?? 0)
                break
            case 'linkReference':
                length += definitions.get(node.identifier) ?? 0
                break
            case 'imageReference':
                length += (definitions.get(node.identifier) ?? 0) + (node.alt?.length ?? 0)
                break
            default:
                break
        }
    }
    return length
}

/**
 * Every node of a tree in the order of the markdown, with the number of lists, items and quotes around it. Without
 * recursion, since markdown may nest deeper than the stack goes.
 */
function allNodes(tree: Root) {
    const found: { node: Nodes, containers: number }[] = []
    const waiting: { node: Nodes, containers: number }[] = [{ node: tree, containers: 0 }]
    for (let entry = waiting.pop(); entry; entry = waiting.pop()) {
        found.push(entry)
        const { node, containers } = entry
        if (!('children' in node)) continue
        const childContainers = isContainer(node) ? containers + 1 : containers
        // Backwards, so the first child is the next one taken.
        for (const child of node.children.toReversed()) waiting.push({ node: child, containers: childContainers })
    }
    return found
}

function isContainer(node: Nodes) {
    return node.type === 'list' || node.type === 'listItem' || node.type === 'blockquote'
}
