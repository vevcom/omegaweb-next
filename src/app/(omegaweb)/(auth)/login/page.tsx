'use client'
import TextInput from '@/UI/TextInput'
import Button from '@/UI/Button'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { FormEvent } from 'react'

// A rule on each side of the text.
const dividerClassName = `
    flex justify-center my-4
    before:m-2 before:flex-1 before:h-0 before:border-b before:border-text-muted
    after:m-2 after:flex-1 after:h-0 after:border-b after:border-text-muted
`

export default function LogIn() {
    const searchParams = useSearchParams()

    const error = searchParams.get('error')

    async function handleSignIn(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)

        await signIn('credentials', {
            username: formData.get('username'),
            password: formData.get('password'),
            redirect: true,
            callbackUrl: searchParams.get('callbackUrl') || '/users/me'
        })
    }

    return <>
        <PageTitleSetter title={'Logg inn'}/>
        <form onSubmit={handleSignIn}>
            <TextInput className="max-w-[unset] mb-4" label="Brukernavn" name="username" type="text"/>
            <TextInput className="max-w-[unset] mb-4" label="Passord" name="password" type="password"/>
            <Button color="primary" style={{ width: '100%', margin: '0' }}>
                Logg inn
            </Button>
            <p style={{ color: 'red' }}>
                {error === 'CredentialsSignin' ? 'Feil brukernavn eller passord :(' : ''}
                {error === 'FeideEmailInUse'
                    ? 'Feide-kontoen kan ikke kobles automatisk til brukeren med samme e-postadresse. ' +
                    'Logg inn med brukernavn og passord, eller ta kontakt med en administrator.'
                    : ''}
                {error === 'UserArchived'
                    ? 'Brukeren er arkivert. Ta kontakt med en administrator dersom dette er feil.'
                    : ''}
            </p>
        </form>

        <div className={dividerClassName}>
            <span>eller</span>
        </div>

        <Button color="secondary" style={{ width: '100%', margin: '0' }} onClick={() => signIn('feide', {
            redirect: true,
            callbackUrl: searchParams.get('callbackUrl') || '/users/me'
        })}>
            Logg inn med Feide
        </Button>

        <Link
            href="/send-reset-password-email"
            className="
                self-start
                [&>p]:my-4 [&>p]:text-accent-blue [&>p]:text-s
                [&:hover>p]:underline
            "
        >
            <p>
                Glemt passord?
            </p>
        </Link>

        <p className="text-text">
            Er det første gang du logger inn? Da er det bare å logge inn med Feide for å lage en bruker.
        </p>
    </>
}
