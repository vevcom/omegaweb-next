'use client'
import Form from '@/components/Form/Form'
import { createLockerLocationAction } from '@/services/lockers/locations/actions'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'

export default function CreateLockerLocationForm() {
    return (
        <Form
            title="Ny skaplokasjon"
            submitText="Opprett"
            action={createLockerLocationAction}
            refreshOnSuccess
            closePopUpOnSuccess="create_locker_location"
        >
            <TextInput
                label="Bygning"
                name="building"
            />
            <NumberInput
                label="Etasje"
                name="floor"
            />
        </Form>
    )
}
