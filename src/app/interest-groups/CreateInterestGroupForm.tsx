import Form from '@/components/Form/Form'
import { createInterestGroupAction } from '@/services/groups/interestGroups/actions'
import TextInput from '@/components/UI/TextInput'

export default function CreateInterestGroupForm() {
    return (
        <div className="min-w-[50vw] min-h-[50vh] grid place-items-center [&_form]:grid [&_form]:place-items-center [&_form>*]:w-[200px] [&_form>*]:m-0 [&_form_button[type=submit]]:w-[220px]">
            <h2>Lag interessegruppe</h2>
            <Form
                refreshOnSuccess
                action={createInterestGroupAction}
                submitText="Lag interessegruppe"
            >
                <TextInput name="name" label="Navn" />
            </Form>
        </div>
    )
}
