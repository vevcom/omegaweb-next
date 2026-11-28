'use client'
import { defineKind } from './kind'
import { SelectString } from '@/components/UI/Select'

type Selectable = string | number | null

// An option's value may be a number or none, which an option of the DOM cannot hold, so the input is given positions.
export const selectKind = defineKind<SelectSpec>(
    undefined,
    ({ label, field, options }) => (
        <SelectString
            label={label}
            value={String(options.findIndex(option => option.value === field.value))}
            options={options.map((option, position) => ({ value: String(position), label: option.label }))}
            onChange={position => field.set(options[Number(position)].value)}
            onBlur={field.leave}
        />
    ),
)

/** A select fits a name whose values are words, numbers or none, and its options are values the schema takes there. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- `this` is only typed in an interface.
interface SelectSpec {
    value: Selectable,
    writes: Exclude<this['value'], object>,
    props: SelectProps<Exclude<this['value'], object>>,
}

type SelectProps<Value> = { options: { value: Value, label: string }[] }
