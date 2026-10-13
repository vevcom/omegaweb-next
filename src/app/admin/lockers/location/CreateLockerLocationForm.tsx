'use client'
import Form from '@/components/Form/Form'
import { createLockerLocationAction } from '@/services/lockers/locations/actions'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'

export default function CreateLockerLocationForm() {
    return (
        <div>
            <Form
                title="Opprett ny skaplokasjon"
                submitText="Opprett"
                action={createLockerLocationAction}
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
        </div>
    )
}
