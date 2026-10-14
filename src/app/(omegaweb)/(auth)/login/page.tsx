'use client'
import styles from './page.module.scss'
import TextInput from '@/UI/TextInput'
import Button from '@/UI/Button'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { FormEvent } from 'react'

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
        <form className={styles.loginForm} onSubmit={handleSignIn}>
            <TextInput className={styles.textInput} label="Brukernavn" name="username" type="text"/>
            <TextInput className={styles.textInput} label="Passord" name="password" type="password"/>
            <Button color="primary" style={{ width: '100%', margin: '0' }}>
                Logg inn
            </Button>
            <p style={{ color: 'red' }}>
                {error === 'CredentialsSignin' ? 'Feil brukernavn eller passord :(' : ''}
                {error === 'FeideEmailInUse'
                    ? 'Feide-kontoen kan ikke kobles automatisk til brukeren med samme e-postadresse. ' +
                    'Logg inn med brukernavn og passord, eller ta kontakt med en administrator.'
                    : ''}
            </p>
        </form>

        <div className={styles.divider}>
            <span>eller</span>
        </div>

        <Button color="secondary" style={{ width: '100%', margin: '0' }} onClick={() => signIn('feide', {
            redirect: true,
            callbackUrl: searchParams.get('callbackUrl') || '/users/me'
        })}>
            Logg inn med Feide
        </Button>

        <Link href="/send-reset-password-email" className={styles.resetPasswordLink}>
            <p>
                Glemt passord?
            </p>
        </Link>

        <p className={styles.firstLoginText}>
            Er det første gang du logger inn? Da er det bare å logge inn med feide for å lage en bruker.
        </p>
    </>
}
