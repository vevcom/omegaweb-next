import ConfirmLinkOwUserForm from './ConfirmLinkOwUserForm'
import LinkOwUserForm from './LinkOwUserForm'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { ServerSession } from '@/auth/session/ServerSession'
import { Require } from '@/auth/authorizer/Require'
import { verifyLinkFeideAccountTokenAction } from '@/services/auth/actions'
import { notFound } from 'next/navigation'
import type { SearchParamsServerSide } from '@/lib/queryParams/types'

type PropTypes = SearchParamsServerSide

export default async function LinkOwUser({ searchParams }: PropTypes) {
    const token = QueryParams.token.decode(await searchParams)

    // With a token the visitor came from the confirmation mail. The token alone authorizes
    // the linking, so no session is required - the mail may well be opened in another browser
    // than the one that logged in with Feide.
    if (token) {
        const linkRequest = await verifyLinkFeideAccountTokenAction({ params: { token } })

        if (!linkRequest.success) {
            return <>
                <h1>Ops</h1>
                <p>Lenken er ugyldig eller utløpt. Be om en ny kobling for å prøve igjen.</p>
            </>
        }

        return <ConfirmLinkOwUserForm token={token} linkRequest={linkRequest.data} />
    }

    const { authorized } = Require.user().auth(await ServerSession.fromNextAuth())

    if (!authorized) notFound()

    return <LinkOwUserForm />
}
