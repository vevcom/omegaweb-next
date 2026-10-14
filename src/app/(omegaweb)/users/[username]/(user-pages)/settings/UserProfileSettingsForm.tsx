'use client'
import Form from '@/components/Form/Form'
import Checkbox from '@/components/UI/Checkbox'
import TextInput from '@/components/UI/TextInput'
import Dropdown from '@/components/UI/Dropdown'
import { configureAction } from '@/services/configureAction'
import { updateUserProfileAction } from '@/services/users/actions'
import { sexConfig, relationshipStatusConfig } from '@/services/users/constants'
import { RelationshipStatus, SEX } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

type PropTypes = {
    user: UserFiltered
    emailDomain?: string
}

export default function UserProfileSettingsForm({ user, emailDomain } : PropTypes) {
    const sexOptions = Object.values(SEX).map(sex => ({
        value: sex,
        label: sexConfig[sex].label
    }))

    const relationshipOptions = Object.values(RelationshipStatus).map(relationshipStatus => ({
        value: relationshipStatus,
        label: relationshipStatusConfig[relationshipStatus].label
    }))

    return (
        <Form
            title="Profilinnstillinger"
            submitText="Lagre"
            action={configureAction(updateUserProfileAction, { params: { username: user.username } })}
        >
            <p>Har du andre brukerinstillinger du ønsker å endre? Kontakt HS på hs@{emailDomain}</p>
            <TextInput label="Mobilnummer" name="mobile" defaultValue={user.mobile ?? ''} />
            <TextInput label="Allergier / diett" name="allergies" defaultValue={user.allergies || ''} />
            <Dropdown
                label="Kjønn"
                name="sex"
                options={sexOptions}
                defaultValue={user.sex ?? SEX.OTHER}
            />
            <TextInput
                label="Sivilstatus"
                name="relationshipStatusText"
                defaultValue={user.relationshipStatusText || ''}
            />
            <Dropdown
                label="Sivilstatus"
                name="relationshipStatus"
                options={relationshipOptions}
                defaultValue={user.relationshipStatus}
            />
            <Checkbox
                label="Jeg samtykker til å bli tatt bilde av"
                name="imageConsent"
                defaultChecked={user.imageConsent} />
        </Form>
    )
}
