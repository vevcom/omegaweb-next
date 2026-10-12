import '@pn-server-only'
import rehypeFormat from 'rehype-format'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

/**
 * Renders markdown to html that is safe to inject into a page or an email.
 *
 * Raw html in the markdown is dropped by remark-rehype, but markdown syntax alone still produces
 * dangerous html - `[x](javascript:...)` becomes a script-running link - so the tree is run through
 * rehype-sanitize's default (GitHub) schema, which only lets through whitelisted tags, attributes
 * and url protocols.
 *
 * `gfm` turns on GitHub flavored markdown - tables, strikethrough, task lists and bare links. It is
 * parsed before the sanitizing, so what it produces goes through the same schema.
 */
export async function markdownToSafeHtml(markdown: string, { gfm = false }: { gfm?: boolean } = {}): Promise<string> {
    return (await unified()
        .use(remarkParse)
        .use(gfm ? [remarkGfm] : [])
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeFormat)
        .use(rehypeStringify)
        .process(markdown)).toString()
}
