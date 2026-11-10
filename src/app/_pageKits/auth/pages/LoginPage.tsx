import LoginForm from '@/pageKits/auth/components/LoginForm'
import { authLinks } from '@/pageKits/auth/links'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * NextAuth sends a failed sign-in to the login page of the domain it ran on, which the proxy
 * serves as this site's, so the error arrives here with no handover.
 */
export function loginPage(config: AuthPagesConfig) {
    const links = authLinks(config)
    return serverPage({
        servedOn: 'auth-domain',
        allowUnregistered: true,
        operation: ({ searchParams }: PageOperationArgs) => ({
            error: typeof searchParams.error === 'string' ? searchParams.error : null,
            callbackUrl: QueryParams.callbackUrl.decode(searchParams) ?? links.afterLogin(),
        }),
        metadata: () => ({ title: 'Logg inn' }),
        render: ({ data }) => <LoginForm config={config} callbackUrl={data.callbackUrl} initialError={data.error} />,
    })
}
