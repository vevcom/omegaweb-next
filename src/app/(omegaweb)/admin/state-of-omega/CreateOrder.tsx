import { CreateOmegaOrderSubmitter } from './omegaOrderSubmitters'

type PropTypes = {
    allRequirementsFulfilled: boolean
}

export default function CreateOrder({ allRequirementsFulfilled }: PropTypes) {
    return (
        <CreateOmegaOrderSubmitter
            refreshOnSuccess
            submitText="Inkrementer Omega"
            submitColor={allRequirementsFulfilled ? 'primary' : 'error'}
            confirmation={{
                confirm: true,
                text: 'Dette er en alvorlig operasjon. Er du sikker på at du vil fortsette?'
            }}
        />
    )
}
