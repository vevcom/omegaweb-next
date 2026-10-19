'use client'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import { updateLockerAction } from '@/services/lockers/actions'
import { configureAction } from '@/services/configureAction'
import { useLockerLocationOptions } from '@/app/lockers/useLockerLocationOptions'

type LockerLocation = {
    building: string,
    floor: number,
}

type PropTypes = {
    lockerId: number,
    current: LockerLocation,
    locations: LockerLocation[],
}

export default function UpdateLockerForm({ lockerId, current, locations }: PropTypes) {
    const { building, setBuilding, buildingOptions, floorOptions } = useLockerLocationOptions(locations, current)

    return (
        <Form
            title="Flytt skapet"
            submitText="Flytt"
            refreshOnSuccess
            action={configureAction(updateLockerAction, { params: { id: lockerId } })}
        >
            <SelectString
                label="Bygning"
                name="building"
                value={building}
                onChange={setBuilding}
                options={buildingOptions}
            />
            <SelectString
                // A new building has other floors, so the floor starts over when it changes.
                key={building}
                label="Etasje"
                name="floor"
                defaultValue={building === current.building ? current.floor.toString() : undefined}
                options={floorOptions}
            />
        </Form>
    )
}
