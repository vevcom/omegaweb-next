import { destroyManualGroupAction } from '@/services/groups/manualGroups/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'

type PropTypes = {
    id: number,
    name: string,
}

export default function DestroyManualGroup({ id, name }: PropTypes) {
    return (
        <Form
            action={configureAction(destroyManualGroupAction, { params: { id } })}
            refreshOnSuccess
            submitText="Slett"
            submitColor="red"
            confirmation={{
                confirm: true,
                text: `Er du sikker på at du vil slette gruppen ${name}? Alle medlemskap forsvinner med den.`
            }}
        />
    )
}
