'use client'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import { connectStudentCardAction } from '@/services/users/actions'

/**
 * A bare link can bind any card to the clicking session, so ask before overwriting a card
 * the user has already registered.
 */
export default function ConnectStudentCardForm({
    studentCard,
    currentStudentCard,
    userId,
}: {
    studentCard: string,
    currentStudentCard: string | null,
    userId: number,
}) {
    const replacesCard = currentStudentCard !== null && currentStudentCard !== studentCard

    return (
        <Form
            submitText="Registrer kort"
            confirmation={{
                confirm: replacesCard,
                text: `Du har allerede registrert kortet ${currentStudentCard}. Vil du erstatte det?`,
            }}
            action={configureAction(connectStudentCardAction, { params: { id: userId } })}
        >
            <input type="hidden" name="studentCard" value={studentCard} />
        </Form>
    )
}
