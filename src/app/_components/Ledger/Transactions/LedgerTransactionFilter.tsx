'use client'

import SearchBar from '@/UI/SearchBar'
import NumberInput from '@/UI/NumberInput'
import { SelectString } from '@/UI/Select'
import { useQueryParamSetter } from '@/hooks/useQueryParamSetter'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { convertAmount, displayAmount } from '@/lib/currency/convert'
import { currencySymbol } from '@/lib/currency/config'
import { transactionPurposeNames } from '@/services/ledger/transactions/constants'
import type { LedgerTransactionFilters } from '@/services/ledger/transactions/types'

type Props = {
    filters: LedgerTransactionFilters,
}

const purposeOptions = [
    { value: '', label: 'Alle typer' },
    ...Object.entries(transactionPurposeNames).map(([purpose, name]) => ({ value: purpose, label: name })),
]

const directionOptions = [
    { value: '', label: 'Inn og ut' },
    { value: 'IN', label: 'Inn' },
    { value: 'OUT', label: 'Ut' },
]

// An emptied or negative amount bounds nothing.
function amountFromInput(value: string) {
    const amount = convertAmount(value)
    return value !== '' && amount >= 0 ? amount : null
}

/** Writes the filters to the page's query, which the page reads and passes on to the list. */
export default function LedgerTransactionFilter({ filters }: Props) {
    const setPurpose = useQueryParamSetter(QueryParams.transactionPurpose)
    const setDirection = useQueryParamSetter(QueryParams.transactionDirection)
    const setMinAmount = useQueryParamSetter(QueryParams.minAmount)
    const setMaxAmount = useQueryParamSetter(QueryParams.maxAmount)

    return <div className="flex flex-col gap-2 mb-4">
        <SearchBar defaultValue={filters.search ?? ''} label="Søk i transaksjoner" />
        <div className="flex flex-row flex-wrap gap-2">
            <SelectString
                name="type"
                label="Type"
                options={purposeOptions}
                defaultValue={filters.purpose ?? ''}
                onChange={value => setPurpose(QueryParams.transactionPurpose.decodeValue(value))}
            />
            <SelectString
                name="direction"
                label="Retning"
                options={directionOptions}
                defaultValue={filters.direction ?? ''}
                onChange={value => setDirection(QueryParams.transactionDirection.decodeValue(value))}
            />
            <NumberInput
                name="minAmount"
                label={`Fra beløp (${currencySymbol})`}
                min={0}
                step={0.01}
                defaultValue={filters.minAmount === undefined ? undefined : displayAmount(filters.minAmount)}
                onChange={event => setMinAmount(amountFromInput(event.target.value))}
            />
            <NumberInput
                name="maxAmount"
                label={`Til beløp (${currencySymbol})`}
                min={0}
                step={0.01}
                defaultValue={filters.maxAmount === undefined ? undefined : displayAmount(filters.maxAmount)}
                onChange={event => setMaxAmount(amountFromInput(event.target.value))}
            />
        </div>
    </div>
}
