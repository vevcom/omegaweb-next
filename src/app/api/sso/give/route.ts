import { siteContextOfRequest } from '@/app/siteContextOfRequest'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { issueTransferTicket, transferCallbackUrl } from '@/auth/nextAuth/sessionTransfer'
import { authPagesOf } from '@/lib/sites/authPagesOf'
import { SiteContext } from '@/lib/sites/context'
import { authLinks } from '@/pageKits/auth/links'
import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * The domain the request came to hands its login to `to`, which asked for it: a ticket when the
 * browser is logged in here, none when it is not, so `to` goes on without.
 */
export async function GET(request: NextRequest) {
    const here = (await siteContextOfRequest()).origin()
    const params = request.nextUrl.searchParams
    const to = params.get('to')
    const state = params.get('state')
    const callbackUrl = transferCallbackUrl(params.get('callbackUrl'))
    if (!here || !to || to === here || !SiteContext.isServedOrigin(to) || !state || !callbackUrl) {
        return new NextResponse(null, { status: 400 })
    }

    // Read through the app's own decode, so a session that has ended is not handed on.
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: here.startsWith('https://'),
        decode: authOptions.jwt?.decode,
    })
    const ticket = token
        ? issueTransferTicket({ userId: token.user.id, provider: token.provider, state, to })
        : null

    const receiver = SiteContext.fromAppPath(new URL(to).host, '/')
    const page = authLinks(authPagesOf(receiver.hostSite())).sessionTransfer({ ticket, callbackUrl })
    return NextResponse.redirect(`${to}${receiver.resolveHref(page)}`)
}
