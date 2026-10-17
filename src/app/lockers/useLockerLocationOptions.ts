import { useState } from 'react'

type LockerLocation = {
    building: string,
    floor: number,
}

/**
 * The building and floor choices of a form placing a locker: the floors offered are those of the
 * building chosen. Returns options rather than inputs, so the selects stay direct children of the
 * form and get their own error messages.
 *
 * @param locations - Every locker location.
 * @param initial - The location chosen to begin with. The first building when left out.
 */
export function useLockerLocationOptions(locations: LockerLocation[], initial?: LockerLocation) {
    const buildings = Array.from(new Set(locations.map(location => location.building)))
    const [building, setBuilding] = useState(initial?.building ?? buildings[0] ?? '')

    const floorOptions = locations
        .filter(location => location.building === building)
        .sort((one, two) => one.floor - two.floor)
        .map(location => ({ value: location.floor.toString(), label: `${location.floor}.` }))

    return {
        building,
        setBuilding,
        buildingOptions: buildings.map(name => ({ value: name, label: name })),
        floorOptions,
    }
}
