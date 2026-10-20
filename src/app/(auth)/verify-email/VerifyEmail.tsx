'use client'
import Form from '@/components/Form/Form'
import { verifyEmailAction } from '@/services/auth/actions'
import { configureAction } from '@/services/configureAction'
import { useSession } from '@/auth/session/useSession'
import Link from 'next/link'
import { useState } from 'react'

type VerifiedUser = {
    id: number,
    acceptedTerms: Date | null,
}

/**
 * The button confirming the email address of the token, then where to go from there. A user who has
 * not finished registering is sent on to it.
 */
export default function VerifyEmail({ token }: { token: string }) {
    const session = useSession()
    const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null)
    const sessionUserId = session.loading ? null : session.session.user?.id ?? null

    if (!verifiedUser) {
        return (
            <Form
                action={configureAction(verifyEmailAction, { params: { token } })}
                title="Bekreft e-postadressen din"
                submitText="Bekreft"
                successCallback={(user?: VerifiedUser) => user && setVerifiedUser(user)}
                navigateOnSuccess={(user?: VerifiedUser) => (
                    user?.id === sessionUserId && !user.acceptedTerms ? '/register' : null
                )}
            />
        )
    }

    if (sessionUserId === null) {
        // TODO: If the user arrives here by an invitation email
        // or from another verify email email, we should log the user inn,
        // not just ask the user to do so. Escpecially since invited users can't login with feide.
        return <>
            <p>E-postadressen er bekreftet.</p>
            <Link href="/login">Logg inn</Link>
        </>
    }

    if (sessionUserId !== verifiedUser.id) {
        return <>
            <p>E-postadressen er bekreftet.</p>
            <p>Ups, du er visst logged inn som noen andre, dette kan skape litt problemer.</p>
            <Link href="/logout">Logg ut</Link>
        </>
    }

    return <>
        <p>E-postadressen er bekreftet.</p>
        <Link href="/users/me">Gå til profil siden</Link>
    </>
}
