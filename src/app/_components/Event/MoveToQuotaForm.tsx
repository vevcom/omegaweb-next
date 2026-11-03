import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { moveEventRegistrationToQuotaAction } from '@/services/events/registration/actions'
import { configureAction } from '@/services/configureAction'

type PropTypes = {
    registrationId: number,
    currentQuotaId: number | null,
    /** The quotas of the registration's variant. */
    quotas: { id: number, name: string }[],
}

export default function MoveToQuotaForm({ registrationId, currentQuotaId, quotas }: PropTypes) {
    const choices = quotas.filter(quota => quota.id !== currentQuotaId)
    if (choices.length === 0) return null

    return <Form
        action={configureAction(moveEventRegistrationToQuotaAction, { params: { registrationId } })}
        submitText="Flytt"
        buttonClassName="w-auto!"
        className="flex items-end gap-1"
        refreshOnSuccess
    >
        <SelectNumber name="quotaId" options={choices.map(quota => ({ value: quota.id, label: quota.name }))} />
    </Form>
}
