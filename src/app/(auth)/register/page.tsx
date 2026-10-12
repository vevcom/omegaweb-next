import RegistrationForm from './RegistrationForm'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { userOperations } from '@/services/users/operations'
import { serverPage } from '@/app/serverPage'
import { notFound, redirect } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams, session }: PageOperationArgs) => {
        const callbackUrl = QueryParams.callbackUrl.decode(searchParams) ?? '/users/me'
        if (!session.user) {
            return notFound()
        }
        const updatedUser = await userOperations.read({
            params: {
                id: session.user.id
            }
        })
        if (updatedUser.acceptedTerms) {
            redirect(callbackUrl)
        }
        if (!updatedUser.emailVerified) {
            redirect(`/register-email?${QueryParams.callbackUrl.encodeUrl(callbackUrl)}`)
        }
        return { updatedUser, callbackUrl }
    },
    render: ({ data: { updatedUser, callbackUrl } }) => (
        <RegistrationForm userData={updatedUser} callbackUrl={callbackUrl} />
    ),
})

export default page
export { generateMetadata }
