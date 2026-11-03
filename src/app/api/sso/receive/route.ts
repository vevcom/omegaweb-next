import { siteContextOfRequest } from '@/app/siteContextOfRequest'
import { transferCallbackUrl, transferStateCookie } from '@/auth/nextAuth/sessionTransfer'
import { SiteContext } from '@/lib/sites/context'
import { sessionTransferPaths } from '@/lib/sites/sessionTransferPaths'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * The domain the request came to asks `from`, another configured domain, for its login: it
 * remembers a fresh state for the ticket to carry back, and sends the browser over.
 */
export async function GET(request: NextRequest) {
    const here = (await siteContextOfRequest()).origin()
    const from = request.nextUrl.searchParams.get('from')
    const callbackUrl = transferCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'))
    if (!here || !from || from === here || !SiteContext.isServedOrigin(from) || !callbackUrl) {
        return new NextResponse(null, { status: 400 })
    }

    const state = crypto.randomUUID()
    const response = NextResponse.redirect(`${from}${sessionTransferPaths.give(here, state, callbackUrl)}`)
    const cookie = transferStateCookie(here)
    response.cookies.set(cookie.name, state, cookie.options)
    return response
}
