import type { ComponentType } from 'react'

/**
 * A kind of field: the value an empty one holds, and the component that binds an input of
 * `_components/UI/` to the form. `Spec['writes']` is what it sets in the form, so it fits a name where
 * the schema takes that. The empty value of a text field is `''`. A number field has no number that
 * means empty, so its empty value is `undefined`. `Spec['props']` is what it takes beside `kind`,
 * `name` and `label`.
 */
export function defineKind<Spec extends KindSpec>(
    emptyValue: Spec['writes'] | undefined,
    Component: ComponentType<{ label: string, field: FieldBinding<Spec['writes']> } & Spec['props']>,
): Kind<Spec> {
    return { emptyValue, Component }
}

/**
 * What the component of a kind binds its input with: its one value, and nothing else of the form.
 * A kind whose empty value is `undefined` sets that when its input is emptied. `setReader` sets a
 * value that is costly to make, which the form then makes only when it reads it.
 */
type FieldBinding<Writes> = {
    name: string,
    value: unknown,
    set: (value: Writes | undefined) => void,
    setReader: (read: () => Writes) => void,
    leave: () => void,
}

/**
 * What a kind writes and takes. A kind whose writes and props depend on the name, such as a select
 * whose options are values the schema takes there, declares `value`, the values it can hold, and
 * reads `this['value']` in an interface. A field narrows it to what the schema takes under its name.
 */
export type KindSpec = { value?: unknown, writes: unknown, props: object }

/** The spec of a kind for a name whose schema takes `Value`. */
export type SpecFor<Spec extends KindSpec, Value> = Spec & { value: Value }

type Kind<Spec extends KindSpec> = {
    emptyValue: unknown,
    Component: ComponentType<{ label: string, field: FieldBinding<Spec['writes']> } & Spec['props']>,
    /** In the types alone and never set, so that a table of kinds says what each of them writes and takes. */
    spec?: Spec,
}

export type Kinds<Specs extends Record<string, KindSpec>> = { [Name in keyof Specs]: Kind<Specs[Name]> }

export type SpecsOf<Table> = { [Name in keyof Table]: Table[Name] extends Kind<infer Spec> ? Spec : never }
