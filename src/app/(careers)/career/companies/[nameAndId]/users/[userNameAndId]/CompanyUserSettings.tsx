'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Checkbox from '@/components/UI/Checkbox'
import {
    destroyCompanyUserAction,
    updateCompanyUserAction,
    updateCompanyUserRoleAction,
} from '@/services/careers/companies/users/actions'
import {
    registerNewCompanyUserEmailAction,
    sendCompanyUserPasswordLinkAction,
} from '@/services/careers/companies/users/auth/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { AppHref } from '@/lib/sites/href'
import type { CompanyUserFiltered } from '@/services/careers/companies/users/types'

type PropTypes = {
    companyUser: CompanyUserFiltered,
    /**
     * What the viewer may do with the company user, as the page worked it out. Each form is left out
     * for one who may not.
     */
    capabilities: CapabilitiesJsObject<
        'canUpdate' | 'canUpdateRole' | 'canDestroy' | 'canSendPasswordLink' | 'canChangeEmail'
    >,
    /** The list of the company's users, which is where to go when this one is removed. */
    usersHref: AppHref,
    /** Whether the viewer is this company user, who gives their password to change their email. */
    isSelf: boolean,
}

/** The forms for changing a company user. */
export default function CompanyUserSettings({ companyUser, capabilities, usersHref, isSelf }: PropTypes) {
    const params = { params: { id: companyUser.id } }
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [emailFeedback, setEmailFeedback] = useState<string | null>(null)

    return (
        <>
            {capabilities.canUpdate.authorized && (
                <Form
                    title="Navn"
                    action={configureAction(updateCompanyUserAction, params)}
                    refreshOnSuccess
                    submitText="Lagre"
                >
                    <TextInput name="firstname" label="Fornavn" defaultValue={companyUser.firstname} />
                    <TextInput name="lastname" label="Etternavn" defaultValue={companyUser.lastname} />
                </Form>
            )}
            {capabilities.canSendPasswordLink.authorized && companyUser.active && (
                <Form
                    title="Innlogging"
                    action={configureAction(sendCompanyUserPasswordLinkAction, params)}
                    successCallback={(email?: string) => setSentTo(email ?? null)}
                    submitText="Send lenke for å velge passord"
                >
                    <p>
                        Brukeren får en e-post med en lenke for å velge passord. Slik logger en ny bruker inn
                        første gang, og slik byttes et glemt passord.
                    </p>
                    {sentTo && <p>Lenken er sendt til {sentTo}.</p>}
                </Form>
            )}
            {capabilities.canChangeEmail.authorized && (
                <Form
                    title="E-post"
                    action={configureAction(registerNewCompanyUserEmailAction, params)}
                    successCallback={(result?: { verified: boolean, email: string }) => setEmailFeedback(result?.verified
                        ? 'E-postadressen er allerede bekreftet.'
                        : `Vi har sendt en e-post til ${result?.email} med en lenke for å bekrefte adressen. `
                            + 'Adressen byttes når lenken er fulgt.')}
                    submitText="Bytt e-post"
                >
                    <TextInput name="email" label="Ny e-post" defaultValue={companyUser.email} />
                    {isSelf && <TextInput name="currentPassword" type="password" label="Passordet ditt" />}
                    {emailFeedback && <p>{emailFeedback}</p>}
                </Form>
            )}
            {capabilities.canUpdateRole.authorized && (
                <Form
                    title="Rolle"
                    action={configureAction(updateCompanyUserRoleAction, params)}
                    refreshOnSuccess
                    submitText="Lagre rolle"
                >
                    <Checkbox name="admin" label="Administrator for bedriften" defaultChecked={companyUser.admin} />
                    <Checkbox name="active" label="Aktiv" defaultChecked={companyUser.active} />
                    <p>
                        En administrator registrerer og endrer bedriftens brukere. En deaktivert bruker kan ikke
                        logge inn.
                    </p>
                </Form>
            )}
            {capabilities.canDestroy.authorized && (
                <Form
                    action={configureAction(destroyCompanyUserAction, params)}
                    navigateOnSuccess={usersHref}
                    submitText="Fjern bruker"
                    submitColor="red"
                    confirmation={{
                        confirm: true,
                        text: `Vil du fjerne ${companyUser.firstname} ${companyUser.lastname}?`,
                    }}
                />
            )}
        </>
    )
}
