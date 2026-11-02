import EmailRegistrationForm from './EmailRegistrationForm'
import { Require } from '@/auth/authorizer/Require'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { authPath } from '@/lib/authPaths'
import { userOperations } from '@/services/users/operations'
import { authOperations } from '@/services/auth/operations'
import { serverPage } from '@/app/ServerPage'
import { notFound, redirect } from 'next/navigation'
import type { AuthPagesConfig } from './config'
import type { PageOperationArgs } from '@/app/ServerPage'

export function registerEmailPage(config: AuthPagesConfig) {
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const callbackUrl = QueryParams.callbackUrl.decode(searchParams) ?? config.afterLoginPath
            const authResult = Require.user().auth(session)
            if (!authResult.authorized) return notFound()

            const updatedUser = await userOperations.read({ params: { id: authResult.session.user.id } })
            if (updatedUser.acceptedTerms) redirect(callbackUrl)
            if (updatedUser.emailVerified) {
                redirect(`${authPath(config.site, 'register')}?${QueryParams.callbackUrl.encodeUrl(callbackUrl)}`)
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
