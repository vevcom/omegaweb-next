import { fromHtml } from 'hast-util-from-html'
import { sanitize } from 'hast-util-sanitize'
import { toHtml } from 'hast-util-to-html'

/**
 * Sanitizes html with rehype-sanitize's default (GitHub) schema, which only lets through
 * whitelisted tags, attributes and url protocols - no script, no event handlers, no
 * `javascript:` links.
 *
 * Synchronous and free of server-only code on purpose: it runs wherever html is injected, and
 * CmsParagraph is rendered by client components too (e.g. the paged school list).
 */
export function sanitizeHtml(html: string): string {
    return toHtml(sanitize(fromHtml(html, { fragment: true })))
}
