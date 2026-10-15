'use client'
import { updateScreenAction } from '@/services/screens/actions'
import { screenOrientationLabels } from '@/services/screens/constants'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { SelectString } from '@/components/UI/Select'
import { ScreenOrientation } from '@/prisma-generated-pn-types'
import type { Screen } from '@/prisma-generated-pn-types'

export default function UpdateScreenForm({ screen }: { screen: Pick<Screen, 'id' | 'name' | 'orientation'> }) {
    const updateAction = configureAction(updateScreenAction, { params: { id: screen.id } })

    return <Form
        title="Skjerm"
        action={updateAction}
        submitText="Lagre"
        // The name is the address of the screen, so a new name moves it.
        navigateOnSuccess={updated => (updated ? `/screens/${encodeURIComponent(updated.name)}` : null)}
        refreshOnSuccess
        closePopUpOnSuccess="screenSettings"
    >
        <TextInput name="name" label="Navn" defaultValue={screen.name} />
        <SelectString
            name="orientation"
            label="Retning"
            defaultValue={screen.orientation}
            options={Object.values(ScreenOrientation).map(orientation => ({
                value: orientation,
                label: screenOrientationLabels[orientation],
            }))}
        />
    </Form>
}
