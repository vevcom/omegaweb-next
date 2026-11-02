'use client'
import Form from '@/components/Form/Form'
import { verifyEmailAction } from '@/services/auth/actions'
import { configureAction } from '@/services/configureAction'
import { useSession } from '@/auth/session/useSession'
import { authLinks } from '@/pageKits/auth/links'
import Link from 'next/link'
import { useState } from 'react'
import type { AuthPagesConfig } from './config'

type VerifiedUser = {
    id: number,
    acceptedTerms: Date | null,
}

/**
 * The button confirming the email address of the token, then where to go from there. A user who has
 * not finished registering is sent on to it.
 */
export default function VerifyEmail({ config, token }: { config: AuthPagesConfig, token: string }) {
    const links = authLinks(config)
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
                    user?.id === sessionUserId && !user.acceptedTerms ? links.register() : null
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
            <Link href={links.login()}>Logg inn</Link>
        </>
    }

    if (sessionUserId !== verifiedUser.id) {
        return <>
            <p>E-postadressen er bekreftet.</p>
            <p>Ops, du er visst logget inn som noen andre. Det kan skape litt problemer.</p>
            <Link href={links.logout()}>Logg ut</Link>
        </>
    }

    return <>
        <p>E-postadressen er bekreftet.</p>
        <Link href={links.afterLogin()}>Fortsett</Link>
    </>
}
