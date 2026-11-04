import { createOmegaOrderAction } from '@/services/omegaOrder/actions'
import Form from '@/components/Form/Form'
import React from 'react'

type PropTypes = {
    allRequirementsFulfilled: boolean
}

export default function CreateOrder({ allRequirementsFulfilled }: PropTypes) {
    return (
        <Form
            action={createOmegaOrderAction}
            refreshOnSuccess
            submitText="Inkrementer Omega"
            submitColor={allRequirementsFulfilled ? 'primary' : 'red'}
            confirmation={{
                confirm: true,
                text: 'Dette er en alvorlig operasjon. Er du sikker på at du vil fortsette?'
            }}
        />
    )
}
