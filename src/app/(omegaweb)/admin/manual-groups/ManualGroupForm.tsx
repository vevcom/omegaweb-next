import { createManualGroupAction, updateManualGroupAction } from '@/services/groups/manualGroups/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import type { ManualGroup } from '@/prisma-generated-pn-types'

type PropTypes = {
    manualGroup?: ManualGroup
}

export default function ManualGroupForm({ manualGroup }: PropTypes) {
    const create = manualGroup === undefined

    return (
        <Form
            title={create ? 'Opprett gruppe' : 'Oppdater gruppe'}
            submitText={create ? 'Opprett' : 'Oppdater'}
            action={create
                ? createManualGroupAction
                : configureAction(updateManualGroupAction, { params: { id: manualGroup.id } })
            }
            refreshOnSuccess
        >
            <TextInput name="name" label="Navn" defaultValue={manualGroup?.name ?? ''} />
            <TextInput name="shortName" label="Kortnavn" defaultValue={manualGroup?.shortName ?? ''} />
        </Form>
    )
}
