'use client'
import AttendanceToggle from './AttendanceToggle'
import Form from '@/components/Form/Form'
import { setEventAttendanceFinishedAction } from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'
import { displayDate } from '@/lib/dates/displayDate'
import { displaySlot, onOneDay, slotClock, slotDay } from '@/services/events/slots/display'
import { registrantName } from '@/services/events/registration/registrantName'
import type { SlotAttendance as SlotAttendanceType } from '@/services/events/registration/types'

/**
 * Who came, slot by slot, for a slotted variant: each slot in Oslo time with whoever holds it, marked
 * as having come or not. Once attendance is finished, those not marked did not come.
 */
export default function SlotAttendance({ variantId, title, attendance, registeredById }: {
    variantId: number,
    title: string,
    attendance: SlotAttendanceType,
    registeredById: number,
}) {
    const { slots, finishedAt } = attendance
    if (slots.length === 0) return null
    const oneDay = onOneDay(slots)

    return <section className="flex flex-col gap-2 text-left">
        <h2 className="m-0 text-l font-bold">{title}{oneDay && ` ${slotDay(slots[0].start)}`}</h2>
        <ol className="m-0 p-0 list-none flex flex-col gap-1">
            {slots.map(({ registration, ...slot }) => {
                const attended = Boolean(registration?.attendedAt)
                return <li key={slot.id} className="
                    grid grid-cols-[8rem_1fr_auto] items-center gap-2 px-3 py-1 rounded-inner bg-base-200
                    max-mobile:grid-cols-[1fr_auto]
                ">
                    <span className="tabular-nums">{oneDay ? slotClock(slot) : displaySlot(slot)}</span>
                    {registration ? <>
                        <span>
                            {registrantName(registration)}
                            {(attended || finishedAt) && <span className="text-s text-base-content/80">
                                {attended ? ' – møtt' : ' – ikke møtt'}
                            </span>}
                        </span>
                        <AttendanceToggle
                            registrationId={registration.id}
                            registeredById={registeredById}
                            attended={attended}
                            registrantName={registrantName(registration)}
                        />
                    </> : <span className="text-base-content/60">Ledig</span>}
                </li>
            })}
        </ol>
        {finishedAt ? <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-s text-base-content/80">
                Oppmøtet ble fullført {displayDate(finishedAt, true, false)}. De som ikke er markert som møtt, kom ikke.
            </p>
            <Form
                action={configureAction(setEventAttendanceFinishedAction, { params: { variantId } })}
                submitText="Åpne oppmøtet igjen"
                buttonClassName="w-auto!"
                refreshOnSuccess
            >
                <input type="hidden" name="finished" value={FIELD_IS_PRESENT_VALUE} />
            </Form>
        </div> : <Form
            action={configureAction(setEventAttendanceFinishedAction, { params: { variantId } })}
            submitText="Fullfør oppmøtet"
            buttonClassName="w-auto!"
            confirmation={{
                confirm: true,
                text: 'De som ikke er markert som møtt, regnes da som ikke møtt. Ingen får prikker av det.',
            }}
            refreshOnSuccess
        >
            <input type="hidden" name="finished" value="on" />
        </Form>}
    </section>
}
