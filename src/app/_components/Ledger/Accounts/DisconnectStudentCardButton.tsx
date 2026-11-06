'use client'

import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import { disconnectStudentCardAction } from '@/services/users/actions'

const disconnectWarning = 'Er du sikker på at du vil koble fra NTNU-kortet? ' +
    'Du kan ikke handle i Kiogeskabet før et kort er registrert på nytt.'

export default function DisconnectStudentCardButton({ userId }: { userId: number }) {
    return (
        <Form
            className="w-fit!"
            submitText="Koble fra kort"
            submitColor="red"
            confirmation={{ confirm: true, text: disconnectWarning }}
            refreshOnSuccess
            action={configureAction(disconnectStudentCardAction, { params: { id: userId } })}
        />
    )
}
