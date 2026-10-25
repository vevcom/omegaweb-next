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
            submitText="Inkrementer omega"
            submitColor={allRequirementsFulfilled ? 'primary' : 'red'}
            confirmation={{
                confirm: true,
                text: 'Dette er en alvorlig operasjon å gjøre, er du sikker på at du vil fortsette?'
            }}
        />
    )
}
