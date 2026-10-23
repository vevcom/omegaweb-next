'use client'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import DateInput from '@/components/UI/DateInput'
import Checkbox from '@/components/UI/Checkbox'
import { createLockerReservationAction } from '@/services/lockers/reservations/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'

type PropTypes = {
    lockerId: number
    userId: number
    groupsFormData: {
        value: string,
        label: string
    }[]
}

export default function CreateLockerReservationForm({ lockerId, userId, groupsFormData }: PropTypes) {
    const [indefiniteDate, setIndefiniteDate] = useState(false)

    return (
        <Form
            refreshOnSuccess
            title="Reserver skapet"
            submitText="Reserver"
            action={configureAction(createLockerReservationAction, { params: { lockerId, userId } })}
        >
            <SelectString
                label="Reserver for"
                name="groupId"
                defaultValue="null"
                options={[{ value: 'null', label: 'Meg selv' }, ...groupsFormData]}
            />
            <Checkbox
                label="Reserver på ubestemt tid"
                name="indefiniteDate"
                onChange={() => setIndefiniteDate(!indefiniteDate)}
            />
            {!indefiniteDate && <DateInput label="Reserver fram til" name="endDate" />}
        </Form>
    )
}
