'use client'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import DateInput from '@/components/UI/DateInput'
import Checkbox from '@/components/UI/Checkbox'
import { updateLockerReservationAction } from '@/services/lockers/reservations/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'

type PropTypes = {
    reservation: {
        id: number,
        groupId: number | null,
        endDate: Date | null,
    },
    groupsFormData: {
        value: string,
        label: string
    }[]
}

export default function UpdateLockerReservationForm({ reservation, groupsFormData }: PropTypes) {
    const [indefiniteDate, setIndefiniteDate] = useState(reservation.endDate === null)

    return (
        <Form
            refreshOnSuccess
            title="Endre reservasjonen"
            submitText="Oppdater"
            action={configureAction(updateLockerReservationAction, { params: { id: reservation.id } })}
        >
            <SelectString
                label="Reserver for"
                name="groupId"
                defaultValue={reservation.groupId?.toString() ?? 'null'}
                options={[{ value: 'null', label: 'Meg selv' }, ...groupsFormData]}
            />
            <Checkbox
                label="Reserver på ubestemt tid"
                name="indefiniteDate"
                defaultChecked={indefiniteDate}
                onChange={() => setIndefiniteDate(!indefiniteDate)}
            />
            {!indefiniteDate && (
                <DateInput label="Reserver fram til" name="endDate" defaultValue={reservation.endDate ?? undefined} />
            )}
        </Form>
    )
}
