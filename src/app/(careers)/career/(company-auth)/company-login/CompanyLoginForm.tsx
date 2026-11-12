'use client'
import { signInAsCompanyUser } from '@/app/(careers)/career/(company-auth)/companyLogin'
import { careersAuthLinks } from '@/app/(careers)/career/(auth)/links'
import { careerLinks } from '@/app/(careers)/links'
import TextInput from '@/UI/TextInput'
import SubmitButton from '@/UI/SubmitButton'
import SiteLink from '@/components/SiteLink/SiteLink'
import { useSession } from '@/auth/session/useSession'
import useDomainContext from '@/hooks/useDomainContext'
import { useState } from 'react'
import type { CompanyLoginError } from '@/app/(careers)/career/(company-auth)/companyLogin'
import type { FormEvent } from 'react'

const errorMessages: Record<CompanyLoginError, string> = {
    CredentialsSignin: 'Feil e-post eller passord.',
    AlreadySignedIn: 'Du er allerede logget inn. Logg ut først.',
    Default: 'Noe gikk galt. Prøv igjen.',
}

/**
 * The login of a company user: email and password, and nothing else. It is only offered to a
 * visitor who is not signed in, as a user or as a company user.
 */
export default function CompanyLoginForm() {
    const session = useSession()
    const landOn = useDomainContext().resolveHref(careerLinks.frontpage())
    const [error, setError] = useState<CompanyLoginError | null>(null)
    const [pending, setPending] = useState(false)
    const [signedIn, setSignedIn] = useState(false)

    async function handleSignIn(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (pending || signedIn) return

        const formData = new FormData(event.currentTarget)
        setPending(true)
        setError(null)
        const email = formData.get('email')
        const password = formData.get('password')
        const failure = typeof email === 'string' && typeof password === 'string'
            ? await signInAsCompanyUser(email, password)
            : 'CredentialsSignin'
        setPending(false)
        if (failure) {
            setError(failure)
            return
        }
        setSignedIn(true)
        // A full load, so every server component renders with the new session.
        window.location.href = landOn
    }

    if (!session.loading && !pending && !signedIn) {
        const { user, companyUser } = session.session
        const signedInAs = user?.username ?? (companyUser && `${companyUser.firstname} ${companyUser.lastname}`)
        if (signedInAs) {
            return <>
                <h1>Bedriftsinnlogging</h1>
                <p>
                    Du er allerede logget inn som {signedInAs}.
                    Logg ut for å logge inn som en bedriftsbruker.
                </p>
                <SiteLink href={careersAuthLinks.logout()}>Logg ut</SiteLink>
            </>
        }
    }

    return <>
        <h1>Bedriftsinnlogging</h1>
        {/* POST, so a submit before the page is hydrated never puts the password in the url. */}
        <form method="post" onSubmit={handleSignIn}>
            <TextInput className="max-w-[unset] mb-4" label="E-post" name="email" type="text" />
            <TextInput className="max-w-[unset] mb-4" label="Passord" name="password" type="password" />
            <SubmitButton
                color="primary"
                className="w-full!"
                pending={pending}
                success={signedIn}
                generalErrors={error ? [{ message: errorMessages[error] }] : undefined}
            >
                Logg inn
            </SubmitButton>
        </form>

        <SiteLink href={careerLinks.companyForgotPassword()} className="self-start my-4 text-s">
            Glemt passord?
        </SiteLink>

        <p className="text-s text-base-content/80">
            Denne innloggingen er for bedrifter. Er du student, logger du inn med{' '}
            <SiteLink href={careersAuthLinks.login()}>brukeren din</SiteLink>. En ny bedriftsbruker får en
            e-post fra Contactor eller fra en administrator i bedriften med en lenke for å velge passord.
        </p>
    </>
}
