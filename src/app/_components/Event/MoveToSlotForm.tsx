import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { moveEventRegistrationToSlotAsAdminAction } from '@/services/events/registration/actions'
import { displaySlot } from '@/services/events/slots/display'
import { configureAction } from '@/services/configureAction'
import type { SlotOnBoard } from '@/services/events/slots/types'

/** Moves a registration to another free slot of its variant, as an administrator. */
export default function MoveToSlotForm({ registrationId, slots, registrantName }: {
    registrationId: number,
    /** The slots of the registration's variant. */
    slots: SlotOnBoard[],
    /** Who is moved, which a screen reader says with the select. */
    registrantName: string,
}) {
    const free = slots.filter(slot => slot.holder === null)
    if (free.length === 0) return null

    return <Form
        action={configureAction(moveEventRegistrationToSlotAsAdminAction, { params: { registrationId } })}
        submitText="Flytt"
        buttonClassName="w-auto!"
        className="flex items-end gap-1"
        refreshOnSuccess
    >
        <SelectNumber
            name="slotId"
            label="Ledig tidsluke"
            aria-label={`Ledig tidsluke for ${registrantName}`}
            options={free.map(slot => ({ value: slot.id, label: displaySlot(slot) }))}
        />
    </Form>
}
