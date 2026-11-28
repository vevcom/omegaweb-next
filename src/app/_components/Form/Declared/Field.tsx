'use client'
import { SubmitterContext } from './submitterContext'
import { FormInputSlot } from '@/components/Form/FormContext'
import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import type { FormStore } from './formStore'
import type { KindSpec, Kinds } from './Kinds/kind'
import type { Context, ReactNode } from 'react'

/**
 * The field of one submitter. It reads the store from the context of the submitter it was made
 * with, so it writes to that form and to no other, and renders the component of the kind it is
 * given. The table of kinds is a parameter so that the compiler follows that a kind's component
 * and its props belong together.
 */
export function makeField<Specs extends Record<string, KindSpec>>(
    OwnStoreContext: Context<FormStore | null>,
    kinds: Kinds<Specs>,
) {
    return function Field<KindName extends keyof Specs>(props: AnyFieldProps<Specs, KindName>) {
        const store = useContext(OwnStoreContext)
        const insideSubmitter = useContext(SubmitterContext) !== null
        if (!store) {
            throw new Error(insideSubmitter
                ? `The field "${props.name}" is inside another submitter than the one it was made with. `
                    + 'A field writes only to its own submitter: use the field that was exported beside this submitter.'
                : `The field "${props.name}" is not inside the submitter it was made with. `
                    + 'A pop-up renders what is in it outside whatever is around it, '
                    + 'so a form in a pop-up has its submitter inside the pop-up too.')
        }
        const kind = kinds[props.kind]
        const { errors, ...stored } = useStoredValue(store, props.name, kind.emptyValue)

        return <FormInputSlot
            input={<kind.Component {...props} field={{ ...stored, name: props.name }} />}
            errors={errors}
            pending={false}
        />
    }
}

/**
 * The field of a schema: `kind` is a key of the table of kinds, `name` is a name that fits that
 * kind, and the other props are that kind's. They are also what the implementation takes, so the
 * one implementation is the field of every schema.
 */
export type FieldOf<Input, Specs extends Record<string, KindSpec>> = <
    KindName extends keyof Specs,
    Name extends NamesFor<Input, Specs[KindName]['writes']>,
>(props: AnyFieldProps<Specs, KindName> & { name: Name }) => ReactNode

/**
 * The names that fit a kind: those where the schema takes what the kind writes. A name is a
 * top-level key of the schema's input. This is the one place a path into a nested value is added.
 */
type NamesFor<Input, Writes> = {
    [Key in keyof Input & string]: [Writes] extends [Input[Key]] ? Key : never
}[keyof Input & string]

type AnyFieldProps<Specs extends Record<string, KindSpec>, KindName extends keyof Specs> =
    { kind: KindName, name: string, label: string } & Specs[KindName]['props']

function useStoredValue(store: FormStore, name: string, emptyValue: unknown) {
    useEffect(() => store.mount(name, emptyValue), [store, name, emptyValue])

    const subscribe = useCallback((listener: () => void) => store.subscribeToField(name, listener), [store, name])
    const value = useSyncExternalStore(subscribe, () => store.value(name), () => store.value(name))
    const errors = useSyncExternalStore(subscribe, () => store.errors(name), () => store.errors(name))

    return {
        value,
        errors,
        set: (next: unknown) => store.setValue(name, next),
        setReader: (read: () => unknown) => store.setReader(name, read),
        leave: () => store.leave(name),
    }
}
