import LoginForm from '@/pageKits/auth/components/LoginForm'
import { authLinks } from '@/pageKits/auth/links'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { Site } from '@/lib/sites/site'
import { authPagesOf } from '@/lib/sites/authPagesOf'
import { serverPage } from '@/app/ServerPage'
import { siteHref } from '@/app/siteContextOfRequest'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * The callbackUrl NextAuth keeps for the login in progress, as a path. NextAuth sends every sign-in
 * error to Omega's login page, the one it is configured with, so this is how a login started on
 * another site finds its way back there. Checked like the callbackUrl parameter, since NextAuth
 * stores whatever starts with a slash, and the continue link skips its own check.
 */
async function pathOfLoginInProgress() {
    const store = await cookies()
    const stored = store.get('__Secure-next-auth.callback-url')?.value ?? store.get('next-auth.callback-url')?.value
    if (!stored) return null
    try {
        const url = new URL(stored, 'http://local.invalid')
        return QueryParams.callbackUrl.decodeValue(`${url.pathname}${url.search}`)
    } catch {
        return null
    }
}

export function loginPage(config: AuthPagesConfig) {
    const links = authLinks(config)
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams }: PageOperationArgs) => {
            const error = typeof searchParams.error === 'string' ? searchParams.error : null
            const callbackUrl = QueryParams.callbackUrl.decode(searchParams)
            if (callbackUrl || !error) return { error, callbackUrl: callbackUrl ?? links.afterLogin() }

            const startedOn = await pathOfLoginInProgress()
            if (startedOn && Site.ofPath(startedOn) !== Site.of(config.site)) {
                const startedOnLinks = authLinks(authPagesOf(Site.ofPath(startedOn)))
                const login = `${startedOnLinks.login({ callbackUrl: startedOn })}&${new URLSearchParams({ error })}`
                redirect(await siteHref(login))
            }
            return { error, callbackUrl: startedOn ?? links.afterLogin() }
        },
        metadata: () => ({ title: 'Logg inn' }),
        render: ({ data }) => <LoginForm config={config} callbackUrl={data.callbackUrl} initialError={data.error} />,
    })
}
