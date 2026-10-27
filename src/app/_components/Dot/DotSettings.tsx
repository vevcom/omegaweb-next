'use client'
import Form from '@/components/Form/Form'
import NumberInput from '@/UI/NumberInput'
import TextInput from '@/UI/TextInput'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { configureAction } from '@/services/configureAction'
import { destroyDotAction, updateDotAction } from '@/services/dots/actions'
import type { DotExpanded } from '@/services/dots/types'

type PropTypes = {
    dot: DotExpanded,
    showUpdateForm: boolean,
    showDestroyForm: boolean,
}

/**
 * A pop up with the forms for changing and deleting a dot.
 * @param dot - The dot to administrate.
 * @param showUpdateForm - Whether to offer changing the dot.
 * @param showDestroyForm - Whether to offer deleting the dot.
 */
export default function DotSettings({ dot, showUpdateForm, showDestroyForm }: PropTypes) {
    return (
        <SettingsHeaderItemPopUp title="Endre prikk" popUpKey={`dotSettings ${dot.id}`}>
            {
                showUpdateForm &&
                <Form
                    action={configureAction(updateDotAction, { params: { id: dot.id } })}
                    submitText="Endre"
                    refreshOnSuccess
                >
                    <NumberInput name="value" label="Antall prikker" defaultValue={dot.value} />
                    <TextInput name="reason" label="Grunn" defaultValue={dot.reason} />
                </Form>
            }
            {
                showDestroyForm &&
                <Form
                    action={configureAction(destroyDotAction, { params: { id: dot.id } })}
                    submitText="Slett"
                    submitColor="red"
                    confirmation={{
                        confirm: true,
                        text: 'Er du sikker på at du vil slette denne prikken?',
                    }}
                    refreshOnSuccess
                />
            }
        </SettingsHeaderItemPopUp>
    )
}
