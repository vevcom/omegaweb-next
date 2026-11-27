import { CreateLockerLocationField, CreateLockerLocationSubmitter } from './lockerLocationSubmitters'

export default function CreateLockerLocationForm() {
    return (
        <CreateLockerLocationSubmitter
            title="Ny skaplokasjon"
            submitText="Opprett"
            refreshOnSuccess
            closePopUpOnSuccess="create_locker_location"
        >
            <CreateLockerLocationField kind="string" name="building" label="Bygning" />
            <CreateLockerLocationField kind="number" name="floor" label="Etasje" />
        </CreateLockerLocationSubmitter>
    )
}
