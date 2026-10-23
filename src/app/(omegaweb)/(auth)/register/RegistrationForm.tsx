'use client'
import { configureAction } from '@/services/configureAction'
import { registerUserAction } from '@/services/users/actions'
import Form from '@/components/Form/Form'
import Checkbox from '@/components/UI/Checkbox'
import { SelectString } from '@/components/UI/Select'
import TextInput from '@/components/UI/TextInput'
import { sexConfig } from '@/services/users/constants'
import { Sex, type User } from '@/prisma-generated-pn-types'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'

export default function RegistrationForm({
    userData,
    callbackUrl,
}: {
    userData: Pick<User, 'id' | 'username' | 'allergies' | 'sex'>,
    callbackUrl: string,
}) {
    const [lastPassword, setLastPassword] = useState('')
    const [sexValue, setSexValue] = useState<Sex | undefined>(userData.sex ?? undefined)

    const sexOptions = Object.values(Sex).map(sex => ({
        value: sex,
        label: sexConfig[sex].label
    }))

    return <Form
        title="Ekstra brukerinformasjon"
        submitText="Fullfør registrering"
        action={configureAction(registerUserAction, { params: { id: userData.id } })}
        successCallback={() => signIn('credentials', {
            username: userData.username,
            password: lastPassword,
            redirect: true,
            callbackUrl
        })}
    >
        <TextInput label="Allergier / diett" name="allergies" defaultValue={userData.allergies ?? ''} />
        <TextInput type="password" label="Passord" name="password" onChange={(e) => { setLastPassword(e.target.value) }} />
        <TextInput type="password" label="Gjenta passord" name="confirmPassword" />
        <SelectString
            label="Kjønn"
            name="sex"
            options={sexOptions}
            value={sexValue}
            onChange={(e) => setSexValue(e as Sex)} />
        <Checkbox label="Jeg samtykker til å bli tatt bilde av" name="imageConsent" />
        <Checkbox name="acceptedTerms">
            <span>
                Jeg godtar&nbsp;
                {/*
                    The link sits inside the checkbox's own label, so a click on it would toggle the
                    checkbox as well - hence the stopPropagation. It opens in a new tab to leave the
                    half-filled form standing.
                */}
                <Link
                    href="/terms"
                    target="_blank"
                    onClick={event => event.stopPropagation()}
                >vilkårene og personvernerklæringen</Link>
            </span>
        </Checkbox>
    </Form>
}
