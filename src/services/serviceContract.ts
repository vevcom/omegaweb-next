import type { RequireBuilder } from '@/auth/authorizer/Require'
import type { UserGuaranteeOption } from '@/auth/session/Session'
import type { Action } from '@/services/actionTypes'
import type { z } from 'zod'

// Declared and never defined, so the mark is in the types alone and no value holds it.
declare const contractMark: unique symbol

/**
 * What each operation of a service takes and who may run it: an entry per operation, with its
 * params schema, its data schema and its rule. This file imports nothing of the server, so a
 * contract can be imported by the browser too.
 */
export function defineContract<Entries extends Record<string, EntryConfig> & KnownKeysOnly<Entries>>(
    entries: Entries
): Contract<Entries> {
    // The mark is a property no value holds, so only an assertion can give it.
    return entries as Entries & Contract<Entries>
}

/**
 * Joins a contract with the actions of its operations, by key. The result has every key of the
 * contract, with no action where none was given.
 */
export function defineCapabilities<
    Entries extends Record<string, AnyContractEntry>,
    Actions extends { [Key in keyof Actions]: Key extends keyof Entries ? ActionOfEntry<Entries[Key]> : never },
>(contract: Entries, actions: Actions): DeclaredCapabilities<Entries, Actions> {
    const actionOf: Partial<Record<string, unknown>> = actions
    // Object.fromEntries types every key as string, so the contract's keys are asserted.
    return Object.fromEntries(Object.entries(contract).map(([key, entry]) => [
        key,
        { params: entry.params, data: entry.data, authorizer: entry.authorizer, action: actionOf[key] },
    ])) as DeclaredCapabilities<Entries, Actions>
}

/** Carried by an entry, by the operation made from it and by the action made from that. */
export type Marked<Mark> = { readonly [contractMark]: Mark }

/** The mark of a value, or nothing for a value that has none, such as an operation made without an entry. */
export type MarkOf<Value> = Value extends Marked<infer Mark> ? Marked<Mark> : unknown

/** A rule as an entry holds it: a `Require` chain, with or without the data it still needs. */
export type Rule = RequireBuilder<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- The data is contravariant, so any alone takes it.
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- The filter is each rule's own, so any stands for it.
    any,
    UserGuaranteeOption,
    UserGuaranteeOption
>

/** The data a rule still needs before it can be run. */
export type RuleData<EntryRule extends Rule> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Only the data is read, and any matches the rest.
    EntryRule extends RequireBuilder<infer RequiredData, any, any, any> ? RequiredData : never

export type ContractEntry<
    Mark,
    ParamsSchema extends Schema,
    DataSchema extends Schema,
    EntryRule extends Rule,
> = {
    readonly params: ParamsSchema,
    readonly data: DataSchema,
    readonly authorizer: EntryRule,
} & Marked<Mark>

type AnyContractEntry = ContractEntry<unknown, Schema, Schema, Rule>

type Schema = z.ZodTypeAny | undefined

type EntryConfig = {
    params?: z.ZodTypeAny,
    data?: z.ZodTypeAny,
    authorizer: Rule,
}

/** Refuses a key an entry does not have, such as a misspelt `parms`, which would otherwise be dropped without a word. */
type KnownKeysOnly<Entries> = {
    [Key in keyof Entries]: { [Part in keyof Entries[Key]]: Part extends keyof EntryConfig ? Entries[Key][Part] : never }
}

type SchemaOf<Config, Part extends 'params' | 'data'> =
    Config extends Record<Part, infer PartSchema extends z.ZodTypeAny> ? PartSchema : undefined

/**
 * Each entry is marked with its key and its contract. The key tells two entries of one contract
 * apart when their schemas and rule are the same, and the contract tells two contracts with the
 * same key apart. The contract is in a function type so that it is invariant, since an action
 * that takes less than the entry would otherwise pass as one of it.
 */
type Contract<Entries extends Record<string, EntryConfig>> = {
    readonly [Key in keyof Entries & string]: ContractEntry<
        { key: Key, contract: (entries: Entries) => Entries },
        SchemaOf<Entries[Key], 'params'>,
        SchemaOf<Entries[Key], 'data'>,
        Entries[Key]['authorizer']
    >
}

/** What `makeAction` gives for the operation of an entry, whatever it returns. */
type ActionOfEntry<Entry extends AnyContractEntry> =
    Action<unknown, undefined, Entry['params'], Entry['data']> & Marked<Entry[typeof contractMark]>

type DeclaredCapability<Entry extends AnyContractEntry, EntryAction> = {
    readonly params: Entry['params'],
    readonly data: Entry['data'],
    readonly authorizer: Entry['authorizer'],
    readonly action: EntryAction,
}

type DeclaredCapabilities<Entries extends Record<string, AnyContractEntry>, Actions> = {
    readonly [Key in keyof Entries]: DeclaredCapability<Entries[Key], Key extends keyof Actions ? Actions[Key] : undefined>
}
