'use client'
import PopUp from '@/components/PopUp/PopUp'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import { createEventDotsForNonattendingUsersAction } from '@/services/events/registration/actions'
import { maxDotsForNotShowingUp } from '@/services/events/registration/constants'
import { configureAction } from '@/services/configureAction'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { EventRegistrationNotAttended } from '@/services/events/registration/types'

const popUpKey = 'giveDotsToAbsentees'

type PropTypes = {
    eventId: number,
    /** The one giving the dots - the session's own user, as a dot is given in the name of its giver. */
    accuserId: number,
    notAttended: EventRegistrationNotAttended[],
}

/**
 * A button opening the list of everyone who did not show up to the event, for giving them all a dot
 * at once. The list is shown before anything is given, and anyone may be taken off it first - a
 * single click never gives a dot to a dozen people.
 */
export default function GiveDotsToAbsentees({ eventId, accuserId, notAttended }: PropTypes) {
    const [sparedUserIds, setSparedUserIds] = useState<number[]>([])
    const receiving = notAttended.filter(registration => !sparedUserIds.includes(registration.user.id))

    const action = configureAction(
        configureAction(createEventDotsForNonattendingUsersAction, { implementationParams: { eventId } }),
        { params: { accuserId } },
    )

    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonContent="Gi prikker til de som ikke møtte opp"
            showButtonClass="btn"
        >
            <div className="min-w-[min(28rem,85vw)]">
                <Form
                    action={action}
                    title="Prikker for ikke å ha møtt opp"
                    submitText={`Gi prikker til ${receiving.length}`}
                    closePopUpOnSuccess={popUpKey}
                    refreshOnSuccess
                >
                    <NumberInput
                        name="value"
                        label="Antall prikker til hver"
                        defaultValue={1}
                        min={1}
                        max={maxDotsForNotShowingUp}
                    />
                    <TextInput name="reason" label="Grunn" defaultValue="Møtte ikke opp" />
                    <ul className="list-none p-0 my-2 max-h-[50vh] overflow-y-auto [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-2 [&>li]:py-1 [&>li]:border-b [&>li]:border-[#adb5bd] [&>li>button]:bg-transparent [&>li>button]:border-none [&>li>button]:cursor-pointer [&>li>button]:text-accent-red [&>li>button]:p-1" aria-label="Får prikker">
                        {receiving.map(registration => (
                            <li key={registration.id}>
                                <span>{registration.user.firstname} {registration.user.lastname}</span>
                                <input type="hidden" name="userIds" value={registration.user.id} />
                                <button
                                    type="button"
                                    aria-label={`Ikke gi prikk til ${registration.user.username}`}
                                    onClick={() => setSparedUserIds([...sparedUserIds, registration.user.id])}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </li>
                        ))}
                    </ul>
                    {receiving.length === 0 && <p className="text-text-muted">Ingen igjen å gi prikker til.</p>}
                </Form>
            </div>
        </PopUp>
    )
}
