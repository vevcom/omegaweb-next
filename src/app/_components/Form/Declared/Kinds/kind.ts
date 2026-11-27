import type { ComponentType } from 'react'

/**
 * A kind of field: the value an empty one holds, and the component that binds an input of
 * `_components/UI/` to the form. `Writes` is what it sets in the form, so it fits a name where the
 * schema takes that. The empty value of a text field is `''`. A number field has no number that
 * means empty, so its empty value is `undefined`. `Props` is what it takes beside `kind`, `name`
 * and `label`.
 */
export function defineKind<Writes, Props extends object>(
    emptyValue: Writes | undefined,
    Component: ComponentType<{ label: string, field: FieldBinding<Writes> } & Props>,
): Kind<{ writes: Writes, props: Props }> {
    return { emptyValue, Component }
}

/**
 * What the component of a kind binds its input with: its one value, and nothing else of the form.
 * A kind whose empty value is `undefined` sets that when its input is emptied.
 */
type FieldBinding<Writes> = {
    name: string,
    value: unknown,
    set: (value: Writes | undefined) => void,
    leave: () => void,
}

export type KindSpec = { writes: unknown, props: object }

type Kind<Spec extends KindSpec> = {
    emptyValue: unknown,
    Component: ComponentType<{ label: string, field: FieldBinding<Spec['writes']> } & Spec['props']>,
    /** In the types alone and never set, so that a table of kinds says what each of them writes and takes. */
    spec?: Spec,
}

export type Kinds<Specs extends Record<string, KindSpec>> = { [Name in keyof Specs]: Kind<Specs[Name]> }

export type SpecsOf<Table> = { [Name in keyof Table]: Table[Name] extends Kind<infer Spec> ? Spec : never }
