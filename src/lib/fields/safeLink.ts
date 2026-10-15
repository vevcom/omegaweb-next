/**
 * Whether a link written by a user may go straight into an href: an internal path (`/...`, or the
 * `./` a link not yet filled in holds), an http(s) url or a mailto address. Any other scheme is
 * refused - `javascript:` would run on click and `data:` would render whatever it carries - and so
 * is a protocol relative path (`//host`), which leaves the site while looking internal.
 */
export const isSafeLink = (link: string): boolean => {
    if (link.startsWith('//')) return false
    if (link.startsWith('/') || link.startsWith('./')) return true
    try {
        return ['http:', 'https:', 'mailto:'].includes(new URL(link).protocol)
    } catch {
        return false
    }
}

export const safeLinkMessage = 'Lenken må være en intern sti (/...), en http(s)-URL eller en mailto-adresse'
