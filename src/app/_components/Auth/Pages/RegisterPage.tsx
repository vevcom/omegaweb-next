import RegistrationForm from './RegistrationForm'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { authPath } from '@/lib/authPaths'
import { userOperations } from '@/services/users/operations'
import { serverPage } from '@/app/ServerPage'
import { notFound, redirect } from 'next/navigation'
import type { AuthPagesConfig } from './authPages'
import type { PageOperationArgs } from '@/app/ServerPage'

export function registerPage(config: AuthPagesConfig) {
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const callbackUrl = QueryParams.callbackUrl.decode(searchParams) ?? config.afterLoginPath
            if (!session.user) notFound()
            const updatedUser = await userOperations.read({ params: { id: session.user.id } })
            if (updatedUser.acceptedTerms) redirect(callbackUrl)
            if (!updatedUser.emailVerified) {
                redirect(`${authPath(config.site, 'registerEmail')}?${QueryParams.callbackUrl.encodeUrl(callbackUrl)}`)
            }
            return { updatedUser, callbackUrl }
        },
        metadata: () => ({ title: 'Fullfør registrering' }),
        render: ({ data }) => (
            <RegistrationForm config={config} userData={data.updatedUser} callbackUrl={data.callbackUrl} />
        ),
    })
}
