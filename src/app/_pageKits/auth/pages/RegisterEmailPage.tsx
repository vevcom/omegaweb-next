import EmailRegistrationForm from '@/pageKits/auth/components/EmailRegistrationForm'
import { authLinks } from '@/pageKits/auth/links'
import { Require } from '@/auth/authorizer/Require'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { userOperations } from '@/services/users/operations'
import { authOperations } from '@/services/auth/operations'
import { serverPage } from '@/app/ServerPage'
import { notFound, redirect } from 'next/navigation'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { PageOperationArgs } from '@/app/ServerPage'

export function registerEmailPage(config: AuthPagesConfig) {
    const links = authLinks(config)
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const callbackUrl = QueryParams.callbackUrl.decode(searchParams) ?? links.afterLogin()
            const authResult = Require.user().auth(session)
            if (!authResult.authorized) return notFound()

            const updatedUser = await userOperations.read({ params: { id: authResult.session.user.id } })
            if (updatedUser.acceptedTerms) redirect(callbackUrl)
            if (updatedUser.emailVerified) {
                redirect(links.register(callbackUrl))
            }

            const feideLoginMatch = await authOperations.readFeideLoginMatch({
                params: { userId: authResult.session.user.id },
            })
            return { updatedUser, feideLoginMatch, callbackUrl }
        },
        metadata: () => ({ title: 'Registrering' }),
        render: ({ data }) => (
            <EmailRegistrationForm
                config={config}
                user={data.updatedUser}
                feideLoginMatch={data.feideLoginMatch}
                callbackUrl={data.callbackUrl}
            />
        ),
    })
}
