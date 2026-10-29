'use client'
import Form from '@/components/Form/Form'
import NumberInput from '@/UI/NumberInput'
import TextInput from '@/UI/TextInput'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { useSession } from '@/auth/session/useSession'
import { configureAction } from '@/services/configureAction'
import { createDotAction } from '@/services/dots/actions'

const createPopUpKey = 'createDot'

type PropTypes = {
    userId: number,
}

/**
 * A pop up with the form for giving a new dot. A dot can only be given in the name of the one giving
 * it, so the session user is the accuser.
 * @param userId - The user the dot is given to.
 */
export default function CreateDotForm({ userId }: PropTypes) {
    const session = useSession()
    if (session.loading || !session.session.user) return null

    return (
        <AddHeaderItemPopUp title="Gi ny prikk" popUpKey={createPopUpKey} scale={18}>
            <Form
                action={configureAction(createDotAction, {
                    params: { accuserId: session.session.user.id },
                })}
                submitText="Gi prikk"
                closePopUpOnSuccess={createPopUpKey}
                refreshOnSuccess
            >
                <NumberInput name="value" label="Antall prikker" defaultValue={1} />
                <TextInput name="reason" label="Grunn" />
                <input type="hidden" name="userId" value={userId} />
            </Form>
        </AddHeaderItemPopUp>
    )
}
