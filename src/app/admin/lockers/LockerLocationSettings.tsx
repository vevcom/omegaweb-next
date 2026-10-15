import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { destroyLockerLocationAction, updateLockerLocationAction } from '@/services/lockers/locations/actions'
import { configureAction } from '@/services/configureAction'
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
                    <Form
                        title={`Endre ${name}`}
                        submitText="Lagre"
                        action={configureAction(updateLockerLocationAction, { params: { id: location.id } })}
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    >
                        <TextInput label="Bygning" name="building" defaultValue={location.building} />
                        <NumberInput label="Etasje" name="floor" defaultValue={location.floor} />
                    </Form>
                )}
                {capabilities.canDestroy.authorized && (location._count.lockers > 0 ? (
                    <p className="max-w-[360px] text-text-muted">
                        Lokasjonen har {location._count.lockers} skap, og kan ikke slettes før de er slettet.
                    </p>
                ) : (
                    <Form
                        submitText="Slett lokasjonen"
                        submitColor="red"
                        action={configureAction(destroyLockerLocationAction, { params: { id: location.id } })}
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
