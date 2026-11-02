import LoginForm from './LoginForm'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { siteOfPath } from '@/lib/sites'
import { authPath } from '@/lib/authPaths'
import { serverPage } from '@/app/ServerPage'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { AuthPagesConfig } from './config'
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
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams }: PageOperationArgs) => {
            const error = typeof searchParams.error === 'string' ? searchParams.error : null
            const callbackUrl = QueryParams.callbackUrl.decode(searchParams)
            if (callbackUrl || !error) return { error, callbackUrl: callbackUrl ?? config.afterLoginPath }

            const startedOn = await pathOfLoginInProgress()
            if (startedOn && siteOfPath(startedOn) !== config.site) {
                redirect(`${authPath(siteOfPath(startedOn), 'login')}?${new URLSearchParams({ error })}&${
                    QueryParams.callbackUrl.encodeUrl(startedOn)}`)
            }
            return { error, callbackUrl: startedOn ?? config.afterLoginPath }
        },
        metadata: () => ({ title: 'Logg inn' }),
        render: ({ data }) => <LoginForm config={config} callbackUrl={data.callbackUrl} initialError={data.error} />,
    })
}
