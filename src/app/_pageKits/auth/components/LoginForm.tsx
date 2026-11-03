'use client'
import TextInput from '@/UI/TextInput'
import Button from '@/UI/Button'
import SubmitButton from '@/UI/SubmitButton'
import { useSession } from '@/auth/session/useSession'
import useSiteContext from '@/hooks/useSiteContext'
import { authLinks } from '@/pageKits/auth/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import { sessionTransferPaths } from '@/lib/sites/sessionTransferPaths'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { FormEvent } from 'react'

type PropTypes = {
    config: AuthPagesConfig,
    callbackUrl: string,
    initialError: string | null,
}

// A rule on each side of the text.
const dividerClassName = `
    flex justify-center my-4
    before:m-2 before:flex-1 before:h-0 before:border-b before:border-text-muted
    after:m-2 after:flex-1 after:h-0 after:border-b after:border-text-muted
`

const errorMessages: Record<string, string> = {
    CredentialsSignin: 'Feil brukernavn eller passord :(',
    FeideEmailInUse: 'Feide-kontoen kan ikke kobles automatisk til brukeren med samme e-postadresse. ' +
        'Logg inn med brukernavn og passord, eller ta kontakt med en administrator.',
    UserArchived: 'Brukeren er arkivert. Ta kontakt med en administrator dersom dette er feil.',
}

export default function LoginForm({ config, callbackUrl: callbackAppPath, initialError }: PropTypes) {
    const session = useSession()
    const callbackUrl = useSiteContext().resolveHref(callbackAppPath)
    // Where NextAuth sends the browser once logged in: the hand-over of the login to the hub, which
    // then goes on to the page.
    const afterSignIn = sessionTransferPaths.share(callbackAppPath)

    // Feide errors arrive in the url. Credentials errors are kept here, so a new attempt clears them.
    const [error, setError] = useState(initialError)
    const [pending, setPending] = useState(false)
    const [signedIn, setSignedIn] = useState(false)

    async function handleSignIn(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (pending || signedIn) return

        const formData = new FormData(event.currentTarget)

        setPending(true)
        setError(null)
        try {
            // Without the redirect, a failed attempt can never navigate over one that succeeded.
            const result = await signIn('credentials', {
                username: formData.get('username'),
                password: formData.get('password'),
                redirect: false,
                callbackUrl: afterSignIn,
            })

            if (!result?.ok || result.error) {
                setError(result?.error ?? 'CredentialsSignin')
                return
            }

            setSignedIn(true)
            // A full load, so every server component renders with the new session.
            window.location.href = result.url ?? afterSignIn
        } catch {
            // NextAuth does not catch a sign-in request that fails on the network.
            setError('Default')
        } finally {
            setPending(false)
        }
    }

    // signIn loads the new session before it returns, which must not flash this view.
    const sessionUser = session.loading ? null : session.session.user
    if (sessionUser && !pending && !signedIn) {
        return <>
            <p>Du er allerede logget inn som {sessionUser.username}.</p>
            <SiteLink href={callbackUrl}>Fortsett</SiteLink>
            <SiteLink href={authLinks(config).logout()}>Logg ut</SiteLink>
        </>
    }

    return <>
        {/* POST, so a submit before the page is hydrated never puts the password in the url. */}
        <form method="post" onSubmit={handleSignIn}>
            <TextInput className="max-w-[unset] mb-4" label="Brukernavn" name="username" type="text"/>
            <TextInput className="max-w-[unset] mb-4" label="Passord" name="password" type="password"/>
            <SubmitButton
                color="primary"
                className="w-full!"
                pending={pending}
                success={signedIn}
                generalErrors={error ? [{ message: errorMessages[error] ?? 'Noe gikk galt. Prøv igjen.' }] : undefined}
            >
                Logg inn
            </SubmitButton>
        </form>

        <div className={dividerClassName}>
            <span>eller</span>
        </div>

        <Button color="secondary" style={{ width: '100%', margin: '0' }} onClick={() => signIn('feide', {
            redirect: true,
            callbackUrl: afterSignIn,
        })}>
            Logg inn med Feide
        </Button>

        <SiteLink
            href={authLinks(config).sendResetPasswordEmail()}
            className="
                self-start
                [&>p]:my-4 [&>p]:text-accent-blue [&>p]:text-s
                [&:hover>p]:underline
            "
        >
            <p>
                Glemt passord?
            </p>
        </SiteLink>

        <p className="text-text">
            Er det første gang du logger inn? Da er det bare å logge inn med Feide for å lage en bruker.
        </p>
        {config.accountNotice && <p className="text-text-muted text-s">{config.accountNotice}</p>}
    </>
}
