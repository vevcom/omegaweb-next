'use client'
import { createLockerAction } from '@/services/lockers/actions'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import NumberInput from '@/components/UI/NumberInput'
import { useLockerLocationOptions } from '@/app/lockers/useLockerLocationOptions'

type PropTypes = {
    locations: {
        building: string,
        floor: number
    }[]
}

export default function CreateLockerForm({ locations }: PropTypes) {
    const { building, setBuilding, buildingOptions, floorOptions } = useLockerLocationOptions(locations)

    if (buildingOptions.length === 0) {
        return <p>Opprett en skaplokasjon før du oppretter skap.</p>
    }

    return (
        <Form
            title="Nytt skap"
            submitText="Opprett"
            action={createLockerAction}
            refreshOnSuccess
            closePopUpOnSuccess="create_locker"
        >
            <SelectString
                label="Bygning"
                name="building"
                value={building}
                onChange={setBuilding}
                options={buildingOptions}
            />
            <SelectString
                label="Etasje"
                name="floor"
                options={floorOptions}
            />
            <NumberInput
                label="Skapnummer"
                name="id"
                min="0"
            />
        </Form>
    )
}
