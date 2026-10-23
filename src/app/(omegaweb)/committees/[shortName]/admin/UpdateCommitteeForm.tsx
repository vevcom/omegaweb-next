'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { updateCommitteeAction } from '@/services/groups/committees/actions'

type PropTypes = {
    id: number,
    name: string,
    shortName: string,
}

export default function UpdateCommitteeForm({ id, name, shortName }: PropTypes) {
    const updateCommittee = configureAction(updateCommitteeAction, { params: { id } })

    return (
        <Form
            action={updateCommittee}
            submitText="Lagre"
            refreshOnSuccess
            // The page lives under the short name, so a new one moves it.
            navigateOnSuccess={committee => (
                committee ? `/committees/${encodeURIComponent(committee.shortName)}/admin` : null
            )}
        >
            <TextInput name="name" label="Navn" defaultValue={name} />
            <TextInput name="shortName" label="Kortnavn" defaultValue={shortName} />
        </Form>
    )
}
