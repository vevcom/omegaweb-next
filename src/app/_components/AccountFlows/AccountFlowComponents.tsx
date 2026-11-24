'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useDomainContext from '@/hooks/useDomainContext'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { accountSchemas } from '@/services/accountFlows/schemas'
import type { Action, ActionFormData } from '@/services/actionTypes'
import type { AppHref } from '@/lib/sites/href'
import type { SiteName } from '@/lib/sites/site'
import type { Awaitable } from '@/lib/awaitable'
import type { ReactNode } from 'react'
import type { z } from 'zod'

type Params = typeof accountSchemas.params
type Data = typeof accountSchemas.data

type AccountFlowActions<Verified> = {
    sendResetPasswordEmail: Action<string, undefined, Params['sendResetPasswordEmail'], Data['sendResetPasswordEmail']>,
    resetPassword: Action<unknown, undefined, Params['resetPassword'], z.ZodTypeAny>,
    verifyEmail: Action<Verified, undefined, Params['verifyEmail'], undefined>,
}

type SignInAfterPasswordChosen = {
    /** Signs in with the email the link was sent to and the password chosen. True when signed in. */
    signIn: (email: string, password: string) => Awaitable<boolean>,
    signedIn: AppHref,
    /** Also where to go when the link carries no email to sign in with. */
    signInFailed: AppHref,
}

type AfterPasswordChosen<Mount> = { navigate: (mount: Mount) => AppHref } | SignInAfterPasswordChosen

type AccountFlowComponentsConfig<Verified, Mount> = {
    actions: AccountFlowActions<Verified>,
    site: (mount: Mount) => SiteName,
    resetPasswordForm: { title: string, submitText: string },
    afterPasswordChosen: AfterPasswordChosen<Mount>,
    EmailVerified: (props: NoInfer<{ account: Verified } & Mount>) => ReactNode,
}

/**
 * The frontend's counterpart of `implementAccountFlows`. `Mount` is what each component is given
 * besides its own props such as the token, like the config of the site's pages it is rendered on.
 */
export function implementAccountFlowComponents<Verified extends { email: string }, Mount extends object = object>({
    actions,
    site,
    resetPasswordForm,
    afterPasswordChosen,
    EmailVerified,
}: AccountFlowComponentsConfig<Verified, Mount>) {
    function SendResetPasswordEmailForm(mount: Mount) {
        const [feedback, setFeedback] = useState('')

        return <>
            <Form
                submitText="Send e-post"
                title="Glemt passord"
                action={configureAction(actions.sendResetPasswordEmail, { params: { site: site(mount) } })}
                successCallback={(email) => {
                    setFeedback(`
                        Hvis e-posten finnes i databasen, har vi sendt en e-post til ${email} med instruksjoner for
                        å nullstille passordet. Det kan ta noen minutter før den kommer fram.`)
                }}
            >
                <TextInput label="E-post" name="email" />
            </Form>
            <p>{ feedback }</p>
        </>
    }

    function ResetPasswordForm(props: {
        token: string,
        email: string | null,
    } & Mount) {
        const resetPassword = configureAction(actions.resetPassword, { params: { token: props.token } })

        if ('navigate' in afterPasswordChosen) {
            return <PasswordForm action={resetPassword} navigateOnSuccess={afterPasswordChosen.navigate(props)} />
        }
        return <SigningInPasswordForm resetPassword={resetPassword} email={props.email} signingIn={afterPasswordChosen} />
    }

    function VerifyEmail(props: { token: string } & Mount) {
        const [account, setAccount] = useState<Verified | null>(null)

        if (account === null) {
            return (
                <Form
                    action={configureAction(actions.verifyEmail, { params: { token: props.token } })}
                    title="Bekreft e-postadressen din"
                    submitText="Bekreft"
                    successCallback={(verified: Verified) => setAccount(verified)}
                />
            )
        }

        return <EmailVerified {...props} account={account} />
    }

    function SigningInPasswordForm({ resetPassword, email, signingIn }: {
        resetPassword: ActionFormData<unknown>,
        email: string | null,
        signingIn: SignInAfterPasswordChosen,
    }) {
        const domainContext = useDomainContext()

        return <PasswordForm action={async formData => {
            const result = await resetPassword(formData)
            if (!result.success) return result

            const password = formData.get('password')
            const signedIn = email !== null && typeof password === 'string' && await signingIn.signIn(email, password)
            // A full load, so every server component renders with the new session.
            window.location.href = domainContext.resolveHref(signedIn ? signingIn.signedIn : signingIn.signInFailed)
            return result
        }} />
    }

    function PasswordForm({ action, navigateOnSuccess }: { action: ActionFormData<unknown>, navigateOnSuccess?: AppHref }) {
        return <Form
            title={resetPasswordForm.title}
            submitText={resetPasswordForm.submitText}
            action={action}
            navigateOnSuccess={navigateOnSuccess}
        >
            <TextInput name="password" type="password" label="Passord" />
            <TextInput name="confirmPassword" type="password" label="Bekreft passord" />
        </Form>
    }

    return { SendResetPasswordEmailForm, ResetPasswordForm, VerifyEmail } as const
}
