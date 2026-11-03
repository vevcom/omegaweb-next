import { contentSecurityPolicy } from '@/lib/securityHeaders'
import { SiteContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { Site } from '@/lib/sites/site'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * The header the proxy stamps the requested page into, as the app routes it: with the base path
 * of its site and the query. Server components cannot read their own url, so anything that needs
 * it - like serverPage building a login callbackUrl - reads this header instead.
 */
export const CURRENT_PATH_HEADER = 'x-current-path'

/** The header the proxy stamps the domain the request came to into. With the path, a SiteContext. */
export const SITE_DOMAIN_HEADER = 'x-site-domain'

/** Paths that are the app's rather than a site's: served alike on every domain, never under a base path. */
const isAppWide = (pathname: string) =>
    ['/api/', '/_next/', '/__nextjs', '/store/'].some(prefix => pathname.startsWith(prefix))

export function proxy(request: NextRequest) {
    loadDomainConfig()
    const { pathname, search } = request.nextUrl
    const domain = request.headers.get('host') ?? request.nextUrl.host
    const browserPath = pathname + search
    const context = SiteContext.fromBrowser(domain, browserPath)

    // Once domains are configured, a host that is not one of them gets nothing but the healthcheck.
    if (!context.siteDomain() && SiteContext.domainsForBrowser().length > 0 && pathname !== '/api/health') {
        return new NextResponse(null, { status: 404 })
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(SITE_DOMAIN_HEADER, domain)
    requestHeaders.set(CURRENT_PATH_HEADER, isAppWide(pathname) ? browserPath : context.path)

    // Uploaded files keep the stricter policy their route sets: a sandbox, so a stored file never runs.
    if (pathname.startsWith('/store/')) {
        return NextResponse.next({ request: { headers: requestHeaders } })
    }

    const nonce = btoa(crypto.randomUUID())
    const policy = contentSecurityPolicy(nonce, { development: process.env.NODE_ENV === 'development' })
    // Next.js finds the nonce in the request's policy and puts it on the scripts it renders.
    requestHeaders.set('Content-Security-Policy', policy)

    const response = siteResponse(request, context, requestHeaders)
    response.headers.set('Content-Security-Policy', policy)
    return response
}

/**
 * On a site's own domain the browser asks for site-relative paths, so the page is served from the
 * app path under the site's base path, and the browser's url stays as it is. An app path of a site
 * that reached such a domain unresolved, like contactor.no/career/job-ads, is sent to where it
 * belongs instead. Omega's domains serve every app path as it is.
 */
function siteResponse(request: NextRequest, context: SiteContext, requestHeaders: Headers) {
    const { pathname, search } = request.nextUrl
    if (context.servesBasePaths() || isAppWide(pathname)) {
        return NextResponse.next({ request: { headers: requestHeaders } })
    }
    if (!Site.ofPath(pathname).isRoot) {
        const appPath = pathname + search
        const resolved = SiteContext.fromAppPath(context.domain, appPath).resolveHref(appPath)
        return NextResponse.redirect(new URL(resolved, request.nextUrl), 308)
    }
    const url = request.nextUrl.clone()
    url.pathname = context.hostSite().pagesPath(pathname === '/' ? '' : pathname)
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
}

export const config = {
    // Static assets never read the header, so skip them.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|images/).*)'],
}
