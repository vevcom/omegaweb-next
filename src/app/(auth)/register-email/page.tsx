import EmailRegistrationForm from './EmailregistrationForm'
import { Require } from '@/auth/authorizer/Require'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { userOperations } from '@/services/users/operations'
import { authOperations } from '@/services/auth/operations'
import { serverPage } from '@/app/serverPage'
import { notFound, redirect } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams, session }: PageOperationArgs) => {
        const callbackUrl = QueryParams.callbackUrl.decode(searchParams) ?? '/users/me'
        const authResult = Require.user().auth(session)
        if (!authResult.authorized) return notFound()

        const updatedUser = await userOperations.read({ params: { id: authResult.session.user.id } })

        if (updatedUser.acceptedTerms) {
            redirect(callbackUrl)
        }

        if (updatedUser.emailVerified) {
            redirect(`/register?${QueryParams.callbackUrl.encodeUrl(callbackUrl)}`)
        }

        const feideLoginMatch = await authOperations.readFeideLoginMatch({})
        return { updatedUser, feideLoginMatch, callbackUrl }
    },
    render: ({ data: { updatedUser, feideLoginMatch, callbackUrl } }) => (
        <EmailRegistrationForm user={updatedUser} feideLoginMatch={feideLoginMatch} callbackUrl={callbackUrl} />
    ),
})

export default page
export { generateMetadata }
