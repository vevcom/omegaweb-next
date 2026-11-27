import {
    DestroyLockerLocationSubmitter,
    UpdateLockerLocationField,
    UpdateLockerLocationSubmitter,
} from './lockerLocationSubmitters'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    location: {
        id: number,
        building: string,
        floor: number,
        _count: { lockers: number },
    },
    capabilities: Capabilities<'canUpdate' | 'canDestroy'>,
}

/**
 * The settings pop-up of one locker location: renaming it, and deleting it once it holds no lockers.
 */
export default function LockerLocationSettings({ location, capabilities }: PropTypes) {
    if (!capabilities.canUpdate.authorized && !capabilities.canDestroy.authorized) return null

    const popUpKey = `locker_location_${location.id}`
    const name = `${location.building} ${location.floor}. etasje`

    return (
        <SettingsHeaderItemPopUp popUpKey={popUpKey}>
            <div className="flex flex-col gap-4 min-w-[min(360px,80vw)]">
                {capabilities.canUpdate.authorized && (
                    <UpdateLockerLocationSubmitter
                        params={{ id: location.id }}
                        defaultValues={{ building: location.building, floor: location.floor }}
                        title={`Endre ${name}`}
                        submitText="Lagre"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    >
                        <UpdateLockerLocationField kind="string" name="building" label="Bygning" />
                        <UpdateLockerLocationField kind="number" name="floor" label="Etasje" />
                    </UpdateLockerLocationSubmitter>
                )}
                {capabilities.canDestroy.authorized && (location._count.lockers > 0 ? (
                    <p className="max-w-[360px] text-base-content/80">
                        Lokasjonen har {location._count.lockers} skap, og kan ikke slettes før de er slettet.
                    </p>
                ) : (
                    <DestroyLockerLocationSubmitter
                        params={{ id: location.id }}
                        submitText="Slett lokasjonen"
                        submitColor="error"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                        confirmation={{
                            confirm: true,
                            text: `Er du sikker på at du vil slette ${name}?`,
                        }}
                    />
                ))}
            </div>
        </SettingsHeaderItemPopUp>
    )
}
