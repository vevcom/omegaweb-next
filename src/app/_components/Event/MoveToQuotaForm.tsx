'use client'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { moveEventRegistrationToQuotaAction } from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'

type PropTypes = {
    registrationId: number,
    currentQuotaId: number | null,
    quotas: { id: number, name: string }[],
}

/** Gives a registration a place in a quota the administrator picks, from the waiting list or another quota. */
export default function MoveToQuotaForm({ registrationId, currentQuotaId, quotas }: PropTypes) {
    const choices = quotas.filter(quota => quota.id !== currentQuotaId)
    const [quotaId, setQuotaId] = useState(choices[0]?.id ?? null)
    if (quotaId === null) return null

    return <Form
        action={configureAction(moveEventRegistrationToQuotaAction, { params: { registrationId, quotaId } })}
        submitText="Flytt"
        buttonClassName="w-auto!"
        refreshOnSuccess
    >
        <SelectNumber
            name="quotaId"
            options={choices.map(quota => ({ value: quota.id, label: quota.name }))}
            value={quotaId}
            onChange={setQuotaId}
        />
    </Form>
}
