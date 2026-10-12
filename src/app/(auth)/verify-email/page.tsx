import { EmailVerifiedWrapper } from './EmailVerifiedWrapper'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { authOperations } from '@/services/auth/operations'
import { serverPage } from '@/app/serverPage'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const token = QueryParams.token.decode(searchParams)
        if (!token) {
            notFound()
        }

        const updatedUser = await authOperations.verifyEmail({ params: { token } })
        return updatedUser
    },
    render: ({ data: updatedUser, session }) => {
        const userId = session.user?.id

        if (!userId) {
            // TODO: If the user arrives here by an invitation email
            // or from another verify email email, we should log the user inn,
            // not just ask the user to do so. Escpecially since invited users can't login with feide.
            return <EmailVerifiedWrapper>
                <Link href="/login">Logg inn</Link>
            </EmailVerifiedWrapper>
        }

        if (userId !== updatedUser.id) {
            return <EmailVerifiedWrapper>
                <p>Ups, du er visst logged inn som noen andre, dette kan skape litt problemer.</p>
                <Link href="/logout">Logg ut</Link>
            </EmailVerifiedWrapper>
        }

        if (updatedUser.acceptedTerms) {
            return <EmailVerifiedWrapper>
                <Link href="/users/me">Gå til profil siden</Link>
            </EmailVerifiedWrapper>
        }

        return redirect('/register')
    },
})

export default page
export { generateMetadata }
