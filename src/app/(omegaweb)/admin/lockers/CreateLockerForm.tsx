'use client'
import { createLockerAction } from '@/services/lockers/actions'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import NumberInput from '@/components/UI/NumberInput'
import { useState } from 'react'

type PropTypes = {
    locations: {
        building: string,
        floor: number
    }[]
}

export default function CreateLockerForm({ locations }: PropTypes) {
    const buildings = Array.from(new Set(locations.map(location => location.building)))
    const [currentBuilding, setCurrentBuilding] = useState(buildings[0] ?? '')

    if (buildings.length === 0) {
        return <p>Opprett en skaplokasjon før du oppretter skap.</p>
    }

    const floorOptions = locations
        .filter(location => location.building === currentBuilding)
        .map(location => ({ value: location.floor.toString(), label: `${location.floor}.` }))

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
                value={currentBuilding}
                onChange={setCurrentBuilding}
                options={buildings.map(building => ({ value: building, label: building }))}
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
