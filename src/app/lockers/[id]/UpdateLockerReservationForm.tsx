'use client'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import DateInput from '@/components/UI/DateInput'
import Checkbox from '@/components/UI/Checkbox'
import { updateLockerReservationAction } from '@/services/lockers/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PropTypes = {
    reservationId: number,
    groupsFormData: {
        value: string,
        label: string
    }[]
}

export default function UpdateLockerReservationForm({ reservationId, groupsFormData }: PropTypes) {
    const { refresh } = useRouter()
    const [indefiniteDate, setIndefiniteDate] = useState(false)
    const [groupId, setGroupId] = useState('null')

    function handleGroupIdChange(value: string) {
        setGroupId(value)
    }

    return (
        <Form
            successCallback={refresh}
            title="Oppdater skapreservasjon"
            submitText="Oppdater"
            action={configureAction(updateLockerReservationAction, { params: { id: reservationId } })}
        >
            <SelectString
                label="Reserver for"
                name="groupId"
                value={groupId}
                options={ [{ value: 'null', label: 'Meg selv' }, ...groupsFormData] }
                onChange={handleGroupIdChange}
            />
            <Checkbox
                label="Reserver på ubestemt tid"
                name="indefiniteDate"
                onChange={() => setIndefiniteDate(!indefiniteDate)}
            />
            {!indefiniteDate && <DateInput label="Reserver fram til" name="endDate"/>}
        </Form>
    )
}
