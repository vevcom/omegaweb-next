'use client'
import { signInAsCompanyUser } from '@/app/(careers)/career/(company-auth)/companyLogin'
import { careerLinks } from '@/app/(careers)/links'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useDomainContext from '@/hooks/useDomainContext'
import { chooseCompanyUserPasswordAction } from '@/services/careers/companies/users/account/actions'

type PropTypes = {
    token: string,
    /** The email the link was sent to, which is what the company user signs in with. */
    email: string | null,
}

/**
 * The form a company user chooses their password in. Once it is saved they are signed in with it,
 * so the link in the mail is all a new company user needs to get in.
 */
export default function ChooseCompanyUserPassword({ token, email }: PropTypes) {
    const { resolveHref } = useDomainContext()

    const choosePassword = async (formData: FormData) => {
        const result = await chooseCompanyUserPasswordAction({ params: { token } }, formData)
        if (!result.success) return result

        // Signing in can only fail for a reason the login page explains better, such as someone
        // else being signed in on this browser, so that is where a failure leads.
        const password = formData.get('password')
        const failure = email && typeof password === 'string' ? await signInAsCompanyUser(email, password) : 'Default'
        // A full load, so every server component renders with the new session.
        window.location.href = resolveHref(failure ? careerLinks.companyLogin() : careerLinks.frontpage())
        return result
    }

    return (
        <Form title="Velg passord" submitText="Lagre passord og logg inn" action={choosePassword}>
            <TextInput name="password" type="password" label="Passord" />
            <TextInput name="confirmPassword" type="password" label="Bekreft passord" />
        </Form>
    )
}
