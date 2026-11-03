import { siteContextOfRequest } from '@/app/siteContextOfRequest'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { authPagesOf } from '@/lib/sites/authPagesOf'
import { SiteContext } from '@/lib/sites/context'
import { sessionTransferPaths } from '@/lib/sites/sessionTransferPaths'
import { authLinks } from '@/pageKits/auth/links'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Where a login on the domain the request came to ends: unless this is the hub, the login is
 * handed to it first, so the other domains find it there. Then on to the app path.
 */
export async function GET(request: NextRequest) {
    const context = await siteContextOfRequest()
    const callbackUrl = QueryParams.callbackUrl.decodeValue(request.nextUrl.searchParams.get('callbackUrl') ?? undefined)
        ?? authLinks(authPagesOf(context.site())).afterLogin()
    const destination = context.resolveHref(callbackUrl)

    const here = context.origin()
    const hub = SiteContext.sessionHubOrigin()
    if (!here || !hub || here === hub) {
        // Relative, since without domains the server does not know the origin the browser used.
        return new NextResponse(null, { status: 307, headers: { Location: destination } })
    }
    const absolute = destination.startsWith('/') ? `${here}${destination}` : destination
    return NextResponse.redirect(`${hub}${sessionTransferPaths.receive(here, absolute)}`)
}
