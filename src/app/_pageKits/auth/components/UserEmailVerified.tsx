'use client'
import { useSession } from '@/auth/session/useSession'
import { authLinks } from '@/pageKits/auth/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useEffect } from 'react'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

type PropTypes = {
    account: {
        id: number,
        acceptedTerms: Date | null,
    },
    config: AuthPagesConfig,
}

/** Where a user goes from a verified email. A user who has not finished registering is sent on to it. */
export default function UserEmailVerified({ account, config }: PropTypes) {
    const links = authLinks(config)
    const session = useSession()
    const { push } = useSiteRouter()
    const sessionUserId = session.loading ? null : session.session.user?.id ?? null
    const registerHref = account.id === sessionUserId && !account.acceptedTerms ? links.register() : null

    useEffect(() => {
        if (registerHref) push(registerHref, { servedOn: 'auth-domain' })
    }, [registerHref, push])

    if (sessionUserId === null) {
        // TODO: If the user arrives here by an invitation email
        // or from another verify email email, we should log the user inn,
        // not just ask the user to do so. Escpecially since invited users can't login with feide.
        return <>
            <p>E-postadressen er bekreftet.</p>
            <SiteLink href={links.login()}>Logg inn</SiteLink>
        </>
    }

    if (sessionUserId !== account.id) {
        return <>
            <p>E-postadressen er bekreftet.</p>
            <p>Ops, du er visst logget inn som noen andre. Det kan skape litt problemer.</p>
            <SiteLink href={links.logout()}>Logg ut</SiteLink>
        </>
    }

    return <>
        <p>E-postadressen er bekreftet.</p>
        <SiteLink href={links.afterLogin()}>Fortsett</SiteLink>
    </>
}
