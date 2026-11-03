import LoginForm from '@/pageKits/auth/components/LoginForm'
import { authLinks } from '@/pageKits/auth/links'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { SiteContext } from '@/lib/sites/context'
import { sessionTransferPaths } from '@/lib/sites/sessionTransferPaths'
import { hasAskedForSession } from '@/auth/nextAuth/sessionTransfer'
import { serverPage } from '@/app/ServerPage'
import { siteContextOfRequest, siteRedirect } from '@/app/siteContextOfRequest'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * NextAuth sends a failed sign-in to the login page of the domain it ran on, which the proxy
 * serves as this site's, so the error arrives here with no handover. Before the form, a domain
 * other than the hub asks the hub for a login it may already have.
 */
export function loginPage(config: AuthPagesConfig) {
    const links = authLinks(config)
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const error = typeof searchParams.error === 'string' ? searchParams.error : null
            const callbackUrl = QueryParams.callbackUrl.decode(searchParams) ?? links.afterLogin()
            if (!session.user && !error) await askHubForSession(callbackUrl)
            return { error, callbackUrl }
        },
        metadata: () => ({ title: 'Logg inn' }),
        render: ({ data }) => <LoginForm config={config} callbackUrl={data.callbackUrl} initialError={data.error} />,
    })
}

/** Sends the browser to ask the hub, unless this is the hub or it asked lately and came back without. */
async function askHubForSession(callbackUrl: string) {
    const here = (await siteContextOfRequest()).origin()
    const hub = SiteContext.sessionHubOrigin()
    if (!here || !hub || here === hub || await hasAskedForSession(here)) return
    await siteRedirect(sessionTransferPaths.receive(hub, callbackUrl))
}
