import { bumpClassesAction } from '@/services/groups/classes/actions'
import Form from '@/components/Form/Form'

export default function BumpClasses() {
    return (
        <Form
            action={bumpClassesAction}
            refreshOnSuccess
            submitText="Rykk opp klassene"
            confirmation={{
                confirm: true,
                text: 'Dette rykker alle studenter opp én klasse. Er du sikker på at du vil fortsette?'
            }}
        />
    )
}
