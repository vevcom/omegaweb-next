'use client'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import { connectStudentCardAction } from '@/services/users/actions'
import { useState } from 'react'

/**
 * The server rejects a silent overwrite of an already-registered card with a DUPLICATE error.
 * This turns that rejection into an explicit "are you sure" step.
 */
export default function ConnectStudentCardForm({ studentCard, userId }: { studentCard: string, userId: number }) {
    const [confirmText, setConfirmText] = useState<string | null>(null)
    const action = configureAction(connectStudentCardAction, { params: { id: userId } })

    return (
        <Form
            submitText="Registrer kort"
            confirmation={confirmText ? { confirm: true, text: confirmText } : undefined}
            action={confirmText ? action : async formData => {
                const res = await action(formData)
                if (!res.success && res.errorCode === 'DUPLICATE') {
                    setConfirmText(res.error?.[0]?.message ?? 'Er du sikker på at du vil erstatte kortet ditt?')
                }
                return res
            }}
        >
            <input type="hidden" name="studentCard" value={studentCard} />
            {confirmText && <input type="hidden" name="confirmReplace" value="on" />}
        </Form>
    )
}
