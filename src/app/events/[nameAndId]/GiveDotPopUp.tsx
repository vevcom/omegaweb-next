'use client'
import PopUp from '@/components/PopUp/PopUp'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import { createEventDotAction } from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'

type PropTypes = {
    eventId: number,
    /** The one giving the dot - the session's own user, as a dot is given in the name of its giver. */
    accuserId: number,
    userId: number,
    /** Unique among the pop-ups of the page, as there is one of these per registration. */
    popUpKey: string,
}

/**
 * A button opening the form for giving one registered user a dot for the event. The name of the
 * event is appended to the reason by the operation.
 */
export default function GiveDotPopUp({ eventId, accuserId, userId, popUpKey }: PropTypes) {
    const action = configureAction(
        configureAction(createEventDotAction, { implementationParams: { eventId } }),
        { params: { accuserId } },
    )

    return (
        <PopUp popUpKey={popUpKey} showButtonContent="Gi prikk" showButtonClass="btn whitespace-nowrap">
            <Form
                action={action}
                title="Gi prikk"
                submitText="Gi prikk"
                closePopUpOnSuccess={popUpKey}
                refreshOnSuccess
            >
                <NumberInput name="value" label="Antall prikker" defaultValue={1} min={1} />
                <TextInput name="reason" label="Grunn" />
                <input type="hidden" name="userId" value={userId} />
            </Form>
        </PopUp>
    )
}
