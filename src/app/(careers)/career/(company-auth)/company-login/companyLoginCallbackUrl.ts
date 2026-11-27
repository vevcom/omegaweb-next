import { QueryParams } from '@/lib/queryParams/queryParams'
import { appHref } from '@/lib/sites/href'
import { Site } from '@/lib/sites/site'
import type { AppHref } from '@/lib/sites/href'
import type { SearchParams } from '@/app/ServerPage'

/**
 * The page the company login lands on when it is asked to, which must be a page of the career
 * site, since a company user's session exists nowhere else. Null for anything else, and the login
 * lands on the frontpage.
 */
export function companyLoginCallbackUrl(searchParams: SearchParams): AppHref | null {
    const callbackUrl = QueryParams.callbackUrl.decode(searchParams)
    if (!callbackUrl) return null
    // The site is told from the path a browser would follow, with its dot segments resolved.
    const { pathname, search, hash } = new URL(callbackUrl, 'http://local.invalid')
    return Site.ofPath(pathname) === Site.CAREERS ? appHref(`${pathname}${search}${hash}`) : null
}
