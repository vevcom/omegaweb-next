import RegistrationForm from './RegistrationForm'
import { authLinks } from './links'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { userOperations } from '@/services/users/operations'
import { serverPage } from '@/app/ServerPage'
import { notFound, redirect } from 'next/navigation'
import type { AuthPagesConfig } from './config'
import type { PageOperationArgs } from '@/app/ServerPage'

export function registerPage(config: AuthPagesConfig) {
    const links = authLinks(config)
    return serverPage({
        allowUnregistered: true,
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const callbackUrl = QueryParams.callbackUrl.decode(searchParams) ?? links.afterLogin()
            if (!session.user) notFound()
            const updatedUser = await userOperations.read({ params: { id: session.user.id } })
            if (updatedUser.acceptedTerms) redirect(callbackUrl)
            if (!updatedUser.emailVerified) {
                redirect(links.registerEmail(callbackUrl))
            }
            return { updatedUser, callbackUrl }
        },
        metadata: () => ({ title: 'Fullfør registrering' }),
        render: ({ data }) => (
            <RegistrationForm config={config} userData={data.updatedUser} callbackUrl={data.callbackUrl} />
        ),
    })
}
