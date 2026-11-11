import { contentSecurityPolicy } from '@/lib/securityHeaders'
import { DomainContext, isAppWidePath } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { Site } from '@/lib/sites/site'
import { appHref } from '@/lib/sites/href'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * The header the proxy stamps the requested page into, as the app routes it: with the base path
 * of its site and the query. Server components cannot read their own url, so anything that needs
 * it - like serverPage building a login callbackUrl - reads this header instead.
 */
export const CURRENT_PATH_HEADER = 'x-current-path'

/** The header the proxy stamps the domain the request came to into. With the path, a DomainContext. */
export const SITE_DOMAIN_HEADER = 'x-site-domain'

export function proxy(request: NextRequest) {
    loadDomainConfig()
    const { pathname, search } = request.nextUrl
    const domain = request.headers.get('host') ?? request.nextUrl.host
    const browserPath = pathname + search
    const context = DomainContext.fromBrowser(domain, browserPath)

    // Once domains are configured, a host that is not one of them gets nothing but the healthcheck.
    const configuredHost = context.siteDomain() !== null || context.isDedicatedAuthDomain()
    if (!configuredHost && DomainContext.hasDomains() && pathname !== '/api/health') {
        const aliased = DomainContext.domainOfAlias(domain)
        if (aliased) return NextResponse.redirect(`${aliased.origin}${browserPath}`, 308)
        // A body, so no browser takes the empty answer for a file to download.
        return new NextResponse('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(SITE_DOMAIN_HEADER, domain)
    // NextAuth takes its origin from this header before the host, and a client can send it, so it is
    // pinned to the host checked above.
    requestHeaders.set('x-forwarded-host', domain)
    requestHeaders.set(CURRENT_PATH_HEADER, isAppWidePath(pathname) ? browserPath : context.path)

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
 * belongs instead. Omega's domains serve every app path as it is, and so does a domain set apart
 * to sign users in, which is how it serves each site's auth pages under the site's base path.
 * Which domain a page is served on is not decided here: the page says it, and serverPage sends a
 * request that reached the wrong domain on to the right one.
 */
function siteResponse(request: NextRequest, context: DomainContext, requestHeaders: Headers) {
    const { pathname, search } = request.nextUrl
    if (isAppWidePath(pathname)) {
        return NextResponse.next({ request: { headers: requestHeaders } })
    }
    if (context.servesBasePaths()) {
        return NextResponse.next({ request: { headers: requestHeaders } })
    }
    if (!Site.ofPath(pathname).isRoot) {
        const appPath = pathname + search
        const resolved = DomainContext.fromAppPath(context.domain, appPath).resolveHref(appHref(appPath))
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
