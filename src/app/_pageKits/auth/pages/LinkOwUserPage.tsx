import ConfirmLinkOwUserForm from '@/pageKits/auth/components/ConfirmLinkOwUserForm'
import LinkOwUserForm from '@/pageKits/auth/components/LinkOwUserForm'
import { authLinks } from '@/pageKits/auth/links'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { authOperations } from '@/services/auth/operations'
import { serverPage, withFallback } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { PageOperationArgs } from '@/app/ServerPage'

export function linkOwUserPage(config: AuthPagesConfig) {
    return serverPage({
        // A Feide login whose email matched no imported user gets a fresh user, and claims the old one
        // here - before registering, so the registration must not stand in the way.
        allowUnregistered: true,
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const token = QueryParams.token.decode(searchParams)

            // With a token the visitor came from the confirmation mail. The token alone authorizes
            // the linking, so no session is required - the mail may well be opened in another browser
            // than the one that logged in with Feide. An invalid or expired token is not an error page
            // but a message with a way forward.
            if (token) {
                const linkRequest = await withFallback(
                    authOperations.verifyLinkFeideAccountToken({ params: { token } }),
                    null,
                )
                return { token, linkRequest }
            }

            if (!session.user) notFound()
            return { token: null, userId: session.user.id }
        },
        metadata: () => ({ title: 'Koble til gammel bruker' }),
        render: ({ data }) => {
            if (data.token === null) return <LinkOwUserForm site={config.site} userId={data.userId} />

            if (!data.linkRequest) {
                return <>
                    <h1>Ops</h1>
                    <p>Lenken er ugyldig eller utløpt. Be om en ny kobling for å prøve igjen.</p>
                </>
            }

            return (
                <ConfirmLinkOwUserForm
                    token={data.token}
                    loginPath={authLinks(config).login()}
                    linkRequest={data.linkRequest}
                />
            )
        },
    })
}
