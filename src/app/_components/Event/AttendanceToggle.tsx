import Form from '@/components/Form/Form'
import { setEventAttendanceAction } from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'

/** Marks a registration as having come, by hand, or takes that back. */
export default function AttendanceToggle({ registrationId, registeredById, attended, registrantName }: {
    registrationId: number,
    registeredById: number,
    attended: boolean,
    /** Who the button is for, which a screen reader says with it. */
    registrantName: string,
}) {
    return <Form
        action={configureAction(setEventAttendanceAction, { params: { registrationId, registeredById } })}
        submitText={<>
            <span aria-hidden>{attended ? 'Fjern møtt' : 'Møtt'}</span>
            <span className="sr-only">{attended ? 'Fjern møtt' : 'Møtt'}, {registrantName}</span>
        </>}
        submitColor={attended ? 'red' : 'green'}
        refreshOnSuccess
    >
        <input type="hidden" name="attended" value={attended ? FIELD_IS_PRESENT_VALUE : 'on'} />
    </Form>
}
