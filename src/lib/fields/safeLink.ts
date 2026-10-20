/**
 * Whether a link is a path on this site. A path starting with `//` or `/\` is not, since browsers
 * read both as a link to another host. Neither is a link with a tab or line break, since browsers
 * drop those before reading it, so `/<tab>/host` would become `//host`.
 */
export const isInternalPath = (link: string): boolean => !/[\t\n\r]/.test(link) && /^\/(?![/\\])/.test(link)

/**
 * Whether a link written by a user may go straight into an href: an internal path (`/...`, or the
 * `./` a link not yet filled in holds), an http(s) url or a mailto address. Any other scheme is
 * refused - `javascript:` would run on click and `data:` would render whatever it carries.
 */
export const isSafeLink = (link: string): boolean => {
    if (link.startsWith('/')) return isInternalPath(link)
    if (link.startsWith('./')) return true
    try {
        return ['http:', 'https:', 'mailto:'].includes(new URL(link).protocol)
    } catch {
        return false
    }
}

export const internalPathMessage = 'Lenken må være en sti på nettsiden, som /events'

export const safeLinkMessage = 'Lenken må være en intern sti (/...), en http(s)-URL eller en mailto-adresse'
