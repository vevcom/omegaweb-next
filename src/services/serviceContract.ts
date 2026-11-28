import type { RequireBuilder } from '@/auth/authorizer/Require'
import type { UserGuaranteeOption } from '@/auth/session/Session'
import type { Action } from '@/services/actionTypes'
import type { z } from 'zod'

// Declared and never defined, so the marks are in the types alone and no value holds them.
declare const contractMark: unique symbol
declare const subContractMark: unique symbol
declare const implementsMark: unique symbol

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
 * What each sub-operation of a sub-service takes: an entry per sub-operation, with its params
 * schema and its data schema and no rule. An owner implements an entry in its own contract, with
 * its rule and the implementation params only the owner knows.
 */
export function defineSubContract<Entries extends Record<string, SubEntryConfig> & KnownSubKeysOnly<Entries>>(
    entries: Entries
): SubContract<Entries> {
    // Object.fromEntries types every key as string, and the marks are properties no value holds.
    return Object.fromEntries(Object.entries(entries).map(([key, { params, data }]) => [key, {
        params,
        data,
        implement: ({ implementationParams, authorizer }: { implementationParams?: z.ZodTypeAny, authorizer: Rule }) => ({
            params,
            data,
            implementationParams,
            authorizer,
        }),
    }])) as SubContract<Entries>
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

/** Carried by an entry of a sub-contract, so the sub-operation made from it knows the entries that implement it. */
type SubMarked<SubMark> = { readonly [subContractMark]: SubMark }

/** Carried by an owner's entry that implements the entry of a sub-contract with this mark. */
export type Implementing<SubMark> = { readonly [implementsMark]: SubMark }

/** Carried by an entry that implements nothing, which is what a plain operation is made from. */
export type ImplementingNothing = { readonly [implementsMark]?: undefined }

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
    ImplementationParamsSchema extends Schema = undefined,
> = {
    readonly params: ParamsSchema,
    readonly data: DataSchema,
    readonly implementationParams: ImplementationParamsSchema,
    readonly authorizer: EntryRule,
} & Marked<Mark>

export type SubContractEntry<SubMark, ParamsSchema extends Schema, DataSchema extends Schema> = {
    readonly params: ParamsSchema,
    readonly data: DataSchema,
    /** The owner's entry for this sub-operation: the sub-entry's schemas with the owner's rule and implementation params. */
    readonly implement: <EntryRule extends Rule, ImplementationParamsSchema extends Schema = undefined>(owner: {
        implementationParams?: ImplementationParamsSchema,
        authorizer: EntryRule,
    }) => ImplementedEntryConfig<SubMark, ParamsSchema, DataSchema, EntryRule, ImplementationParamsSchema>,
} & SubMarked<SubMark>

type AnyContractEntry = ContractEntry<unknown, Schema, Schema, Rule, Schema>

type Schema = z.ZodTypeAny | undefined

type PlainEntryConfig = {
    params?: z.ZodTypeAny,
    data?: z.ZodTypeAny,
    authorizer: Rule,
}

/** What `implement` of a sub-contract's entry gives, and nothing else can, since nothing else gives the mark. */
type ImplementedEntryConfig<
    SubMark,
    ParamsSchema extends Schema,
    DataSchema extends Schema,
    EntryRule extends Rule,
    ImplementationParamsSchema extends Schema,
> = {
    readonly params: ParamsSchema,
    readonly data: DataSchema,
    readonly implementationParams: ImplementationParamsSchema,
    readonly authorizer: EntryRule,
} & Implementing<SubMark>

type EntryConfig = PlainEntryConfig | ImplementedEntryConfig<unknown, Schema, Schema, Rule, Schema>

type SubEntryConfig = {
    params?: z.ZodTypeAny,
    data?: z.ZodTypeAny,
}

/**
 * Refuses a key an entry does not have, such as a misspelt `parms`, which would otherwise be
 * dropped without a word. An implemented entry is taken as it is. It is a mapped type and not a
 * conditional one, since a conditional type at its top loses the data type of a rule written in
 * the entry with a check of its own, such as `Require.filter(...)`.
 */
type KnownKeysOnly<Entries> = {
    [Key in keyof Entries]: {
        [Part in keyof Entries[Key]]: Part extends keyof PlainEntryConfig
            ? Entries[Key][Part]
            : Entries[Key] extends Implementing<unknown> ? Entries[Key][Part] : never
    }
}

type KnownSubKeysOnly<Entries> = {
    [Key in keyof Entries]: { [Part in keyof Entries[Key]]: Part extends keyof SubEntryConfig ? Entries[Key][Part] : never }
}

type SchemaOf<Config, Part extends 'params' | 'data' | 'implementationParams'> =
    Config extends Record<Part, infer PartSchema extends z.ZodTypeAny> ? PartSchema : undefined

type ImplementingOf<Config> = Config extends Implementing<infer SubMark> ? Implementing<SubMark> : ImplementingNothing

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
        Entries[Key]['authorizer'],
        SchemaOf<Entries[Key], 'implementationParams'>
    > & ImplementingOf<Entries[Key]>
}

/** Each entry is marked with its key and its sub-contract, as the entries of a contract are. */
type SubContract<Entries extends Record<string, SubEntryConfig>> = {
    readonly [Key in keyof Entries & string]: SubContractEntry<
        { key: Key, subContract: (entries: Entries) => Entries },
        SchemaOf<Entries[Key], 'params'>,
        SchemaOf<Entries[Key], 'data'>
    >
}

/** What `makeAction` gives for the operation of an entry, whatever it returns. */
type ActionOfEntry<Entry extends AnyContractEntry> =
    Action<unknown, Entry['implementationParams'], Entry['params'], Entry['data']> & Marked<Entry[typeof contractMark]>

type DeclaredCapability<Entry extends AnyContractEntry, EntryAction> = {
    readonly params: Entry['params'],
    readonly data: Entry['data'],
    readonly authorizer: Entry['authorizer'],
    readonly action: EntryAction,
}

type DeclaredCapabilities<Entries extends Record<string, AnyContractEntry>, Actions> = {
    readonly [Key in keyof Entries]: DeclaredCapability<Entries[Key], Key extends keyof Actions ? Actions[Key] : undefined>
}
