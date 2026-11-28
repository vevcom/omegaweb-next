import '@ow-server-only'
import { ParseError, ServiceError, Smorekopp } from './error'
import { parseData } from './parseData'
import { prisma as globalPrisma } from '@/prisma-pn-client-instance'
import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import logger from '@/lib/logger'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { AsyncLocalStorage } from 'async_hooks'
import type { ServiceErrorCode } from './error'
import type {
    ContractEntry, Implementing, ImplementingNothing, Marked, Rule, RuleData, SubContractEntry,
} from './serviceContract'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { RequireBuilder } from '@/auth/authorizer/Require'
import type { z } from 'zod'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Prisma, PrismaClient } from '@/prisma-generated-pn-client'
import type { Awaitable } from '@/lib/awaitable'

export type InferredOrInput<Schema extends z.ZodTypeAny | undefined, InferredOrInputMode extends 'INFERRED' | 'INPUT'> =
    Schema extends undefined
    ? object
    : InferredOrInputMode extends 'INFERRED' ? z.infer<NonNullable<Schema>> : z.input<NonNullable<Schema>>

export type ParamsObject<ParamsSchema extends z.ZodTypeAny | undefined, InferredOrInputMode extends 'INFERRED' | 'INPUT'> =
    ParamsSchema extends undefined
    ? object
    : { params: InferredOrInput<ParamsSchema, InferredOrInputMode> }

export type ImplementationParamsObject<
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    InferredOrInputMode extends 'INFERRED' | 'INPUT'
> =
    ImplementationParamsSchema extends undefined
    ? object
    : { implementationParams: InferredOrInput<ImplementationParamsSchema, InferredOrInputMode> }

export type DataObject<DataSchema extends z.ZodTypeAny | undefined, InferredOrInputMode extends 'INFERRED' | 'INPUT'> =
    DataSchema extends undefined
    ? object
    : { data: InferredOrInput<DataSchema, InferredOrInputMode> }

/**
 * This is the type for the argument that are passed to the execute operation of a service operation.
 */
export type ServiceOperationExecuteArgs<
    Unsafe extends 'UNSAFE' | 'SAFE',
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined
> = (
        Unsafe extends 'UNSAFE' ? {
            params?: unknown,
            implementationParams?: unknown,
            data?: unknown,
        } : (
            & ParamsObject<ParamsSchema, 'INPUT'>
            & ImplementationParamsObject<ImplementationParamsSchema, 'INPUT'>
            & DataObject<DataSchema, 'INPUT'>
        )
    )

/**
 * The arguments a caller passes to a service operation. Data is parsed with zfd.formData, so a caller
 * may also pass the FormData from a form as it is.
 */
export type ServiceOperationCallArgs<
    Unsafe extends 'UNSAFE' | 'SAFE',
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined
> =
    | ServiceOperationExecuteArgs<Unsafe, ParamsSchema, DataSchema, ImplementationParamsSchema>
    | (DataSchema extends undefined ? never : (
        & ParamsObject<ParamsSchema, 'INPUT'>
        & ImplementationParamsObject<ImplementationParamsSchema, 'INPUT'>
        & { data: FormData }
    ))

export type ServiceOperationOperation<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    Return,
    PrismaWhereFilter extends object | undefined
> = (
    args:
        & ParamsObject<ParamsSchema, 'INFERRED'>
        & DataObject<DataSchema, 'INFERRED'>
        & ServiceOperationContext<OpensTransaction>
    , prismaWhereFilter: PrismaWhereFilter | undefined
) => Awaitable<Return>

/**
 * How an operation relates to database transactions. NONE runs on whatever client it is given.
 * OPENS opens a transaction itself, so it takes the root client and cannot be called inside a
 * transaction. RUNS_IN runs in the caller's transaction when it is in one, and in a transaction of
 * its own otherwise, for an operation of several writes that belong together. The whole operation
 * runs in it, so one with slow work, or writes that must outlive a later failure, uses OPENS and
 * opens its transaction around the writes that belong together.
 */
export type TransactionFlag = 'NONE' | 'OPENS' | 'RUNS_IN'

/** Whether an operation with the flag opens a transaction, which decides the client it takes. */
type OpensTransactionOf<Flag extends TransactionFlag> = [Flag] extends ['OPENS'] ? true : false

export type SubServiceOperationConfig<
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    Return,
    Flag extends TransactionFlag = 'NONE',
    PrismaWhereFilter extends object | undefined = undefined
> = {
    paramsSchema?: ((implementationFields: ParamsSchemaImplementationFields) => ParamsSchema) | undefined,
    dataSchema?: ((implementationFields: DataSchemaImplementationFields) => DataSchema) | undefined,
    transaction?: Flag,
    operation: (implementationFields: OperationImplementationFields) =>
        ServiceOperationOperation<OpensTransactionOf<Flag>, ParamsSchema, DataSchema, Return, PrismaWhereFilter>
}

export type ArgsAuthGetterAndOwnershipCheck<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined
> =
    & ParamsObject<ParamsSchema, 'INFERRED'>
    & ImplementationParamsObject<ImplementationParamsSchema, 'INFERRED'>
    & DataObject<DataSchema, 'INFERRED'>
    & Pick<ServiceOperationContext<OpensTransaction>, 'prisma'>

export type AuthorizerGetter<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    PrismaWhereFilter extends object | undefined
> = (
    args: ArgsAuthGetterAndOwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>
) =>
        Awaitable<Authorizer<
            'USER_NOT_REQUIRED_FOR_AUTHORIZED' | 'USER_REQUIRED_FOR_AUTHORIZED', PrismaWhereFilter
        >>

export type OwnershipCheck<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
> = (
    args: ArgsAuthGetterAndOwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>
) => Awaitable<boolean>

/**
 * A hook an implementation may run right before the operation itself. It gets the same arguments as
 * the authorizer and the ownership check, so it can read whatever it needs - including from the
 * database - and throw to abort the call.
 *
 * Note that one should use the ownership chack check for any checks conserning if the
 * implementer service owns the resource from the sub service in question. This hook is for
 * additional checks that are not covered by the ownership check.
 */
export type BeforeRun<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
> = (
    args: ArgsAuthGetterAndOwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>
) => Awaitable<void>

/** Runs once the operation has, for what the owning service does in response, such as refilling places. */
export type AfterRun<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
> = (
    args: ArgsAuthGetterAndOwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>
) => Awaitable<void>

/** The fields the schemas of a sub-operation are built from, required when the sub-operation takes them. */
type SchemaImplementationFieldsConfig<
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
> = {
    paramsSchemaImplementationFields?: ParamsSchemaImplementationFields
    dataSchemaImplementationFields?: DataSchemaImplementationFields
} & (ParamsSchemaImplementationFields extends undefined ?
    object
    : {
        paramsSchemaImplementationFields: ParamsSchemaImplementationFields
    }) & (DataSchemaImplementationFields extends undefined ?
        object
        : {
            dataSchemaImplementationFields: DataSchemaImplementationFields
        })

export type ServiceOperationImplementationConfigInternalCall<
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
> = {
    implementationParamsSchema?: ImplementationParamsSchema,
    operationImplementationFields?: OperationImplementationFields
} & SchemaImplementationFieldsConfig<ParamsSchemaImplementationFields, DataSchemaImplementationFields>
    & (OperationImplementationFields extends undefined ?
        object
        : {
            operationImplementationFields: OperationImplementationFields
        })

/**
 * The fields the operation of a sub-operation is built from, as a function of the call: of what the
 * implementation receives, its implementation params above all, which the operation itself never
 * sees. An event appending its name to the reason of a dot reads the name this way. Fields that are
 * the same on every call are given as the plain value instead; both land here as this function.
 */
export type OperationImplementationFieldsOf<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    OperationImplementationFields extends object | undefined,
> = (
    args: ArgsAuthGetterAndOwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>
) => OperationImplementationFields | Promise<OperationImplementationFields>

/**
 * Every key of an implementation, with none of the fields required, so that generic code can hand
 * an implementation on. The two forms of `implement` say which fields are required.
 */
type ImplementationParts<
    OpensTransaction extends boolean,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    PrismaWhereFilter extends object | undefined
> = {
    implementationParamsSchema?: ImplementationParamsSchema,
    paramsSchemaImplementationFields?: ParamsSchemaImplementationFields,
    dataSchemaImplementationFields?: DataSchemaImplementationFields,
    operationImplementationFields?: OperationImplementationFields | OperationImplementationFieldsOf<
        OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema, OperationImplementationFields
    >,
    authorizer: AuthorizerGetter<
        OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema, PrismaWhereFilter | undefined
    >,
    ownershipCheck: OwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>,
    beforeRun?: BeforeRun<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>,
    afterRun?: AfterRun<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>,
}

export type ServiceOperationImplementationConfig<
    OpensTransaction extends boolean,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    PrismaWhereFilter extends object | undefined
> = ImplementationParts<
    OpensTransaction,
    ImplementationParamsSchema,
    ParamsSchema,
    DataSchema,
    ParamsSchemaImplementationFields,
    DataSchemaImplementationFields,
    OperationImplementationFields,
    PrismaWhereFilter
> & SchemaImplementationFieldsConfig<ParamsSchemaImplementationFields, DataSchemaImplementationFields>
    & (OperationImplementationFields extends undefined ?
        object
        : {
            operationImplementationFields: OperationImplementationFields | OperationImplementationFieldsOf<
                OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema, OperationImplementationFields
            >
        })

/**
 * This is the type for the prisma client that is passed to the service operation.
 * It can't simply be PrismaClient because it can be usefull to use a service operation
 * inside a transaction. In that case, the prisma client is a Prisma.TransactionClient.
 * The caveat is that a Prisma.TransactionClient can't be used to open a new transaction
 * so if the service operation opens a transaction, the prisma client can only be a PrismaClient.
 *
 * The check is written as [OpensTransaction] extends [true] rather than the bare
 * OpensTransaction extends true so that it does not distribute over a union. A context that is not
 * tied to an operation gets `boolean` here, and a distributing conditional turns that
 * into PrismaClient | Prisma.TransactionClient - a union whose deeply generic method signatures tsc
 * has to reconcile at every call site, which reaches the instantiation depth limit on some models.
 * Not distributing resolves `boolean` to Prisma.TransactionClient, which is what an operation that
 * has not claimed it opens a transaction is entitled to anyway.
 */
export type PrismaPossibleTransaction<
    OpensTransaction extends boolean
> = [OpensTransaction] extends [true] ? PrismaClient : Prisma.TransactionClient

/**
 * In addition to custom data arguments, every service operation receives a context object.
 */
export type ServiceOperationContext<OpensTransaction extends boolean = boolean> = {
    prisma: PrismaPossibleTransaction<OpensTransaction>,
    session: SessionMaybeUser,
    bypassAuth: boolean,
}

/**
 * Async local storage is used to store the context of the current service operation call.
 * All service operations called within the context of another service operation will
 * inherit the context of the parent service operation, unless explicitly overridden.
 *
 * Read more about async local storage here: https://nodejs.org/api/async_context.html
 */
const asyncLocalStorage = new AsyncLocalStorage<ServiceOperationContext>()


/**
 * Runs a callback with a specific service operation context.
 *
 * @param contextOverride Partial context to override the current context with.
 * @param callback The callback to run with the context.
 * @returns The return value of the callback.
 */
/**
 * Whether the client is the root one, rather than the one of an interactive transaction. Prisma
 * marks the latter with this symbol, and nothing else it exposes tells the two apart: since Prisma 7
 * the transaction client has `$transaction` too, which nests a transaction in the open one.
 */
export function isPrismaClient(prisma: PrismaClient | Prisma.TransactionClient): prisma is PrismaClient {
    return !(Symbol.for('prisma.client.transaction.scope_context') in prisma)
}

/**
 * What a caller sets of the context. Any client may be given, since it is checked against the
 * operation's transaction flag when the context is resolved.
 */
export type ServiceContextOverride = Partial<
    Omit<ServiceOperationContext, 'prisma'> & { prisma: PrismaClient | Prisma.TransactionClient }
>

export function withServiceContext<T, Flag extends TransactionFlag>(
    contextOverride: ServiceContextOverride,
    transaction: Flag | undefined,
    callback: (context: ServiceOperationContext<OpensTransactionOf<Flag>>) => T,
): T {
    const localContext = asyncLocalStorage.getStore()

    const isAppropriateClient = (
        prisma: PrismaClient | Prisma.TransactionClient
    ): prisma is PrismaPossibleTransaction<OpensTransactionOf<Flag>> =>
        transaction !== 'OPENS' || isPrismaClient(prisma)

    const prisma = contextOverride.prisma ?? localContext?.prisma ?? globalPrisma
    if (!isAppropriateClient(prisma)) {
        throw new Smorekopp(
            'SERVER ERROR',
            `Service operation is configured to open a transaction,
            but the prisma client in the context is a transaction client.`
        )
    }

    const context: ServiceOperationContext<OpensTransactionOf<Flag>> = {
        prisma,
        session: contextOverride.session ?? localContext?.session ?? Session.empty(),
        bypassAuth: contextOverride.bypassAuth ?? localContext?.bypassAuth ?? false,
    }

    return asyncLocalStorage.run(context, () => callback(context))
}


/**
 * Get the current service operation context.
 * This includes the current user/api session,
 * prisma client, and whether auth is bypassed.
 *
 * This should only ever be used as a last resort!
 * In service operations you always have the contents
 * of the context available as arguments to the operation.
 */
export function getContext() {
    const localContext = asyncLocalStorage.getStore()
    return localContext
}

/**
 * This is the return type of the ServiceOperation function. It contains a client function that can be used
 * to pass a specific prisma client to the service operation, and a newClient function that can be used to
 * pass the global prisma client to the service operation.
 *
 * TypeScript is smart enough to infer the behaviour of the return functons without the need to excplitly
 * type the return type of the ServiceOperation function, but it is done so for the sake of clarity.
 */
export type ServiceOperation<
    OpensTransaction extends boolean,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined,
> = {
    /**
     * Pass a specific prisma client to the service operation. Usefull when using the service operation inside a transaction.
     * @note
     * @param client
     */
    <Unsafe extends 'UNSAFE' | 'SAFE' = 'SAFE'>(
        args:
            & ServiceOperationCallArgs<Unsafe, ParamsSchema, DataSchema, ImplementationParamsSchema>
            & Partial<ServiceOperationContext<OpensTransaction>>
    ): Promise<Return>,
    paramsSchema?: ParamsSchema,
    dataSchema?: DataSchema,
    implementationParamsSchema?: ImplementationParamsSchema,
}

/**
 * Extracts the caller-facing `{ params: ... }` input type of a service operation (top-level, from
 * defineOperation, or `.implement()`-produced) - i.e. what a caller passes in to call it. Works off
 * of `paramsSchema`, which every such operation exposes as a property on itself, so it applies
 * uniformly regardless of how the operation was built.
 *
 * `paramsSchema` is an optional property, so reading it always yields `Schema | undefined` even
 * when a schema is present - the `extends undefined` check (rather than `extends z.ZodTypeAny`)
 * accounts for that; checking the other way round would make the union fail to extend
 * z.ZodTypeAny (since its `undefined` member never does) and collapse this to `never` always.
 */
export type Params<T extends { paramsSchema?: z.ZodTypeAny }> =
    T['paramsSchema'] extends undefined ? never : z.input<NonNullable<T['paramsSchema']>>

/**
 * Extracts the caller-facing `{ data: ... }` input type of a service operation. See {@link Params}.
 */
export type Data<T extends { dataSchema?: z.ZodTypeAny }> =
    T['dataSchema'] extends undefined ? never : z.input<NonNullable<T['dataSchema']>>

/**
 * Extracts the caller-facing `{ implementationParams: ... }` input type of a service operation
 * produced via `.implement()`. See {@link Params}.
 */
export type ImplementationParams<T extends { implementationParamsSchema?: z.ZodTypeAny }> =
    T['implementationParamsSchema'] extends undefined ? never : z.input<NonNullable<T['implementationParamsSchema']>>

export function defineSubOperation<
    Return,
    Flag extends TransactionFlag = 'NONE',
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
    ParamsSchemaImplementationFields extends object | undefined = undefined,
    DataSchemaImplementationFields extends object | undefined = undefined,
    OperationImplementationFields extends object | undefined = undefined,
    PrismaWhereFilter extends object | undefined = undefined
>(
    serviceOperationConfig: SubServiceOperationConfig<
        ParamsSchema,
        DataSchema,
        ParamsSchemaImplementationFields,
        DataSchemaImplementationFields,
        OperationImplementationFields,
        Return,
        Flag,
        PrismaWhereFilter
    >
): SubServiceOperation<
    Return,
    Flag,
    ParamsSchema,
    DataSchema,
    ParamsSchemaImplementationFields,
    DataSchemaImplementationFields,
    OperationImplementationFields,
    PrismaWhereFilter
>

/**
 * The sub-operation of a sub-contract's entry, with the entry's schemas. An owner implements it
 * from the entry of its own contract that implements this one, or in the form above.
 */
export function defineSubOperation<
    SubMark,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    Return,
>(
    entry: SubContractEntry<SubMark, ParamsSchema, DataSchema>,
    implementation: SubEntryImplementation<ParamsSchema, DataSchema, Return>,
): SubOperationOfEntry<SubMark, Return, ParamsSchema, DataSchema>

export function defineSubOperation<
    Return,
    Flag extends TransactionFlag,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    PrismaWhereFilter extends object | undefined,
>(
    configOrEntry:
        | SubServiceOperationConfig<
            ParamsSchema,
            DataSchema,
            ParamsSchemaImplementationFields,
            DataSchemaImplementationFields,
            OperationImplementationFields,
            Return,
            Flag,
            PrismaWhereFilter
        >
        | SubContractEntry<unknown, ParamsSchema, DataSchema>,
    implementation?: SubEntryImplementation<ParamsSchema, DataSchema, Return>,
) {
    if ('operation' in configOrEntry) return subOperationOfConfig(configOrEntry)
    if (!implementation) {
        throw new Smorekopp('SERVER ERROR', 'A sub-operation made from a sub-contract entry was given no implementation.')
    }
    return subOperationOfEntry(configOrEntry, implementation)
}

type SubEntryImplementation<
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    Return,
> = {
    operation: ServiceOperationOperation<false, ParamsSchema, DataSchema, Return, undefined>,
}

/**
 * What an owner gives to implement a sub-operation from its entry. The schemas and the rule are
 * the entry's, and `authorizerData` is as for a plain operation, with the implementation params.
 */
type OwnerImplementation<
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    EntryRule extends Rule,
> = {
    ownershipCheck: OwnershipCheck<false, ParamsSchema, DataSchema, ImplementationParamsSchema>,
} & AuthorizerDataConfig<ParamsSchema, DataSchema, EntryRule, false, ImplementationParamsSchema>

type SubOperationOfEntry<
    SubMark,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
> = ReturnType<typeof subOperationOfEntry<SubMark, ParamsSchema, DataSchema, Return>>

function subOperationOfConfig<
    Return,
    Flag extends TransactionFlag,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    PrismaWhereFilter extends object | undefined,
>(
    serviceOperationConfig: SubServiceOperationConfig<
        ParamsSchema,
        DataSchema,
        ParamsSchemaImplementationFields,
        DataSchemaImplementationFields,
        OperationImplementationFields,
        Return,
        Flag,
        PrismaWhereFilter
    >
) {
    type OpensTransaction = OpensTransactionOf<Flag>

    const { transaction, implement, internalCall } = subOperationParts(serviceOperationConfig)
    const implementWithRequiredFields: <ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined>(
        implementationArgs: ServiceOperationImplementationConfig<
            OpensTransaction,
            ImplementationParamsSchema,
            ParamsSchema,
            DataSchema,
            ParamsSchemaImplementationFields,
            DataSchemaImplementationFields,
            OperationImplementationFields,
            PrismaWhereFilter
        >
    ) => ServiceOperation<OpensTransaction, Return, ParamsSchema, DataSchema, ImplementationParamsSchema> = implement
    return { transaction, implement: implementWithRequiredFields, internalCall }
}

function subOperationOfEntry<
    SubMark,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    Return,
>(
    entry: SubContractEntry<SubMark, ParamsSchema, DataSchema>,
    { operation }: SubEntryImplementation<ParamsSchema, DataSchema, Return>,
) {
    const { params: paramsSchema, data: dataSchema } = entry
    const parts = subOperationParts<Return, 'NONE', ParamsSchema, DataSchema, undefined, undefined, undefined, undefined>({
        operation: () => operation,
        paramsSchema: paramsSchema !== undefined ? () => paramsSchema : undefined,
        dataSchema: dataSchema !== undefined ? () => dataSchema : undefined,
    })

    function implement<ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined>(
        config: ServiceOperationImplementationConfig<
            false, ImplementationParamsSchema, ParamsSchema, DataSchema, undefined, undefined, undefined, undefined
        >
    ): ServiceOperation<false, Return, ParamsSchema, DataSchema, ImplementationParamsSchema>
    /** From the owner's entry, which implements this sub-entry. The operation runs the entry's rule. */
    function implement<Mark, EntryRule extends Rule, ImplementationParamsSchema extends z.ZodTypeAny | undefined>(
        entry: ContractEntry<Mark, ParamsSchema, DataSchema, EntryRule, ImplementationParamsSchema> & Implementing<SubMark>,
        implementation: OwnerImplementation<ParamsSchema, DataSchema, ImplementationParamsSchema, EntryRule>,
    ): ServiceOperation<false, Return, ParamsSchema, DataSchema, ImplementationParamsSchema> & Marked<Mark>
    function implement<EntryRule extends Rule, ImplementationParamsSchema extends z.ZodTypeAny | undefined>(
        configOrEntry:
            | ImplementationParts<
                false, ImplementationParamsSchema, ParamsSchema, DataSchema, undefined, undefined, undefined, undefined
            >
            | ContractEntry<unknown, ParamsSchema, DataSchema, EntryRule, ImplementationParamsSchema>,
        implementation?: OwnerImplementation<ParamsSchema, DataSchema, ImplementationParamsSchema, EntryRule>,
    ) {
        if ('ownershipCheck' in configOrEntry) return parts.implement(configOrEntry)
        if (!implementation) {
            throw new Smorekopp('SERVER ERROR', 'A sub-operation implemented from an entry was given no implementation.')
        }
        const { authorizerData, ownershipCheck } = implementation
        return parts.implement<ImplementationParamsSchema>({
            implementationParamsSchema: configOrEntry.implementationParams,
            authorizer: async args => configOrEntry.authorizer.data(authorizerData ? await authorizerData(args) : {}),
            ownershipCheck,
        })
    }

    return { transaction: parts.transaction, implement, internalCall: parts.internalCall }
}

/** A sub-operation whose `implement` requires none of the fields, for the two forms above to narrow. */
function subOperationParts<
    Return,
    Flag extends TransactionFlag,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    PrismaWhereFilter extends object | undefined
>(
    serviceOperationConfig: SubServiceOperationConfig<
        ParamsSchema,
        DataSchema,
        ParamsSchemaImplementationFields,
        DataSchemaImplementationFields,
        OperationImplementationFields,
        Return,
        Flag,
        PrismaWhereFilter
    >
) {
    type OpensTransaction = OpensTransactionOf<Flag>

    const implement = <ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined>(
        implementationArgs: ImplementationParts<
            OpensTransaction,
            ImplementationParamsSchema,
            ParamsSchema,
            DataSchema,
            ParamsSchemaImplementationFields,
            DataSchemaImplementationFields,
            OperationImplementationFields,
            PrismaWhereFilter
        >
    ): ServiceOperation<OpensTransaction, Return, ParamsSchema, DataSchema, ImplementationParamsSchema> => {
        const expectedArgsArePresent = (
            args: ServiceOperationExecuteArgs<'UNSAFE', ParamsSchema, DataSchema, ImplementationParamsSchema>
        ): args is ServiceOperationExecuteArgs<'SAFE', ParamsSchema, DataSchema, ImplementationParamsSchema> => {
            const paramsMatch = Boolean(args.params) === Boolean(serviceOperationConfig.paramsSchema)
            const dataMatches = Boolean(args.data) === Boolean(serviceOperationConfig.dataSchema)
            // Boolean-truthiness can't be used here like it is for params/data above: an
            // implementationParamsSchema of z.undefined() is a valid, truthy schema whose only
            // correct value is the falsy `undefined` - so this checks against the schema's actual
            // parse outcome instead of comparing truthiness of the schema and the value.
            const implementationParamsMatch = implementationArgs.implementationParamsSchema
                ? implementationArgs.implementationParamsSchema.safeParse(args.implementationParams).success
                : args.implementationParams === undefined
            return paramsMatch && dataMatches && implementationParamsMatch
        }

        const executeOperation = async ({
            implementationParams, params, data, ...context
        }:
            & ServiceOperationExecuteArgs<'UNSAFE', ParamsSchema, DataSchema, ImplementationParamsSchema>
            & Partial<ServiceOperationContext<OpensTransaction>>
        ): Promise<Return> => {
            const args = {
                implementationParams,
                params,
                data,
            }

            if (args.params) {
                if (!serviceOperationConfig.paramsSchema) {
                    throw new Smorekopp(
                        'BAD PARAMETERS', 'Service operation recieved params, but has no params schema.'
                    )
                }
                const paramsSchema = serviceOperationConfig.paramsSchema(
                    implementationArgs.paramsSchemaImplementationFields!
                )
                if (!paramsSchema) {
                    throw new Smorekopp(
                        'BAD PARAMETERS', 'Service operation recieved params, but has no params schema.'
                    )
                }
                const paramsParse = paramsSchema.safeParse(args.params)

                if (!paramsParse.success) {
                    // The issues travel with the error, as the data's do, so a route or an action can say which parameter.
                    logger.debug('Service operation params failed validation.', { paramsParse })
                    throw new ParseError(paramsParse, 'params')
                }

                args.params = paramsParse.data
            }
            if (args.data) {
                if (!serviceOperationConfig.dataSchema) {
                    throw new Smorekopp(
                        'BAD PARAMETERS', 'Service operation recieved data, but has no data schema. 1'
                    )
                }
                const dataSchema = serviceOperationConfig.dataSchema(
                    implementationArgs.dataSchemaImplementationFields!
                )
                if (!dataSchema) {
                    throw new Smorekopp(
                        'BAD PARAMETERS', 'Service operation recieved data, but has no data schema. 2'
                    )
                }
                const dataParse = parseData(dataSchema, args.data)
                if (!dataParse.success) {
                    if (process.env.NODE_ENV !== 'test') {
                        logger.debug('Service operation data failed validation.', { dataParse })
                    }
                    throw new ParseError(dataParse, 'data')
                }
                args.data = dataParse.data
            }

            if (args.implementationParams) {
                if (!implementationArgs.implementationParamsSchema) {
                    throw new Smorekopp(
                        'BAD PARAMETERS',
                        'Service operation recieved implementation params, but has no implementation params schema.'
                    )
                }
                const implementationParamsSchema = implementationArgs.implementationParamsSchema
                const implementationParamsParse = implementationParamsSchema.safeParse(
                    args.implementationParams
                )
                if (!implementationParamsParse.success) {
                    // The issues travel with the error, as the data's do.
                    logger.info('Service operation implementation params failed validation.', { implementationParamsParse })
                    throw new ParseError(implementationParamsParse, 'params')
                }
                args.implementationParams = implementationParamsParse.data
            }

            if (!expectedArgsArePresent(args)) {
                throw new Smorekopp(
                    'SERVER ERROR',
                    'Service operation recieved invalid arguments.'
                )
            }

            const run = async (
                { prisma, bypassAuth, session }: ServiceOperationContext<OpensTransaction>
            ): Promise<Return> => {
                // Then, authorize user.
                // This has to be done after the validation because the
                // authorizer might use the data to authorize the user.
                const prismaWhereFilter: PrismaWhereFilter | undefined = await (async () => {
                    if (!bypassAuth) {
                        if (!implementationArgs.authorizer) {
                            throw new Smorekopp(
                                'UNAUTHENTICATED',
                                'This service operation is not externally callable.'
                            )
                        }

                        const authorizer = await prismaErrorWrapper(
                            () => implementationArgs.authorizer({ ...args, prisma })
                        )
                        const authResult = authorizer.auth(session)

                        if (!authResult.authorized) {
                            throw new Smorekopp(authResult.failureStatus, authResult.getErrorMessage)
                        }

                        return authResult.prismaWhereFilter
                    }
                    return undefined
                })()

                const ownershipCheckResult = await prismaErrorWrapper(
                    () => implementationArgs.ownershipCheck({
                        ...args,
                        prisma,
                    })
                )
                if (!ownershipCheckResult) {
                    throw new Smorekopp('DISSALLOWED', `
                        This resource cannot be accessed through this implementation
                        as the resource implementing this resource does not own it.
                    `)
                }

                await prismaErrorWrapper(
                    () => implementationArgs.beforeRun?.({
                        ...args,
                        prisma,
                    })
                )

                // Given as a plain value or as a function of the call: made the one shape here. No
                // field type is a function itself, so typeof tells the two apart.
                const fieldsOf = (
                    typeof implementationArgs.operationImplementationFields === 'function'
                        ? implementationArgs.operationImplementationFields
                        : () => implementationArgs.operationImplementationFields
                ) as OperationImplementationFieldsOf<
                    OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema, OperationImplementationFields
                >
                const operationImplementationFields = await prismaErrorWrapper(() => fieldsOf({ ...args, prisma }))

                const result = await prismaErrorWrapper(() =>
                    serviceOperationConfig.operation(
                        operationImplementationFields
                    )({ ...args, prisma, bypassAuth, session }, prismaWhereFilter)
                )
                await prismaErrorWrapper(() => implementationArgs.afterRun?.({ ...args, prisma }))
                return result
            }

            // The context is resolved first, so the operation joins the caller's transaction when it is in one.
            return withServiceContext(
                context,
                serviceOperationConfig.transaction,
                resolved => {
                    if (serviceOperationConfig.transaction !== 'RUNS_IN' || !isPrismaClient(resolved.prisma)) {
                        return run(resolved)
                    }
                    return prismaErrorWrapper(() => resolved.prisma.$transaction(tx => withServiceContext(
                        { prisma: tx },
                        serviceOperationConfig.transaction,
                        run,
                    )))
                }
            )
        }

        executeOperation.paramsSchema = serviceOperationConfig.paramsSchema
            ? serviceOperationConfig.paramsSchema(implementationArgs.paramsSchemaImplementationFields!)
            : undefined
        executeOperation.dataSchema = serviceOperationConfig.dataSchema
            ? serviceOperationConfig.dataSchema(implementationArgs.dataSchemaImplementationFields!)
            : undefined
        executeOperation.implementationParamsSchema = implementationArgs.implementationParamsSchema

        return executeOperation
    }
    return {
        /** As declared, so a type can tell the operations apart by it. */
        transaction: serviceOperationConfig.transaction,
        implement,
        /**
         * Implements the sub-operation right away with require-nothing authorizer and "no" ownership check.
         */
        internalCall: (
            args:
                & ServiceOperationImplementationConfigInternalCall<
                    undefined,
                    ParamsSchemaImplementationFields,
                    DataSchemaImplementationFields,
                    OperationImplementationFields
                >
                & ServiceOperationExecuteArgs<'SAFE', ParamsSchema, DataSchema, undefined>
                & Partial<ServiceOperationContext<OpensTransaction>>
        ) => implement({
            ...args,
            authorizer: () => Require.nothing(),
            ownershipCheck: () => true,
        })(args),
    }
}

export function defineOperation<
    Flag extends TransactionFlag = 'NONE',
    Return = unknown,
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
    PrismaWhereFilter extends object | undefined = undefined
>(
    config: OperationConfig<Flag, Return, ParamsSchema, DataSchema, PrismaWhereFilter>
): ServiceOperation<OpensTransactionOf<Flag>, Return, ParamsSchema, DataSchema, undefined>

/**
 * The operation of a contract entry. Its schemas and its rule are the entry's, so it cannot run
 * another rule than its own. `authorizerData` gives the data the rule still needs.
 */
export function defineOperation<
    Mark,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    EntryRule extends Rule,
    Return,
    Flag extends TransactionFlag = 'NONE',
>(
    entry: ContractEntry<Mark, ParamsSchema, DataSchema, EntryRule> & ImplementingNothing,
    implementation: EntryImplementation<Flag, Return, ParamsSchema, DataSchema, EntryRule>,
): ServiceOperation<OpensTransactionOf<Flag>, Return, ParamsSchema, DataSchema, undefined> & Marked<Mark>

export function defineOperation<
    Flag extends TransactionFlag,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    PrismaWhereFilter extends object | undefined,
    EntryRule extends Rule,
>(
    configOrEntry:
        | OperationConfig<Flag, Return, ParamsSchema, DataSchema, PrismaWhereFilter>
        | ContractEntry<unknown, ParamsSchema, DataSchema, EntryRule>,
    implementation?: EntryImplementation<Flag, Return, ParamsSchema, DataSchema, EntryRule>,
) {
    if ('operation' in configOrEntry) return operationOfConfig(configOrEntry)
    if (!implementation) {
        throw new Smorekopp('SERVER ERROR', 'An operation made from a contract entry was given no implementation.')
    }
    return operationOfEntry(configOrEntry, implementation)
}

type OperationConfig<
    Flag extends TransactionFlag,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    PrismaWhereFilter extends object | undefined,
> = {
    paramsSchema?: ParamsSchema,
    dataSchema?: DataSchema,
    transaction?: Flag,
    authorizer: AuthorizerGetter<
        OpensTransactionOf<Flag>, ParamsSchema, DataSchema, undefined, PrismaWhereFilter | undefined
    >,
    operation: ServiceOperationOperation<OpensTransactionOf<Flag>, ParamsSchema, DataSchema, Return, PrismaWhereFilter>
}

type EntryImplementation<
    Flag extends TransactionFlag,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    EntryRule extends Rule,
> = {
    transaction?: Flag,
    operation: ServiceOperationOperation<
        OpensTransactionOf<Flag>, ParamsSchema, DataSchema, Return, RuleFilter<EntryRule>
    >,
} & AuthorizerDataConfig<ParamsSchema, DataSchema, EntryRule, OpensTransactionOf<Flag>, undefined>

/**
 * Required when the rule needs data, and refused when it needs none. It may give more than the
 * rule needs, as a read of everything a service's rules ask about does, but never a session.
 */
type AuthorizerDataConfig<
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    EntryRule extends Rule,
    OpensTransaction extends boolean,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
> = [keyof RuleData<EntryRule>] extends [never]
    ? { authorizerData?: undefined }
    : {
        authorizerData: (
            args: ArgsAuthGetterAndOwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>
        ) => Awaitable<RuleData<EntryRule> & { session?: never }>
    }

/** The filter a rule hands its operation, as the second argument of `operation`. */
type RuleFilter<EntryRule extends Rule> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Only the filter is read, and any matches the rest.
    EntryRule extends RequireBuilder<any, infer Filter extends object | undefined, any, any>
        ? ([Filter] extends [never] ? undefined : Filter)
        : undefined

function operationOfConfig<
    Flag extends TransactionFlag,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    PrismaWhereFilter extends object | undefined,
>({ paramsSchema, dataSchema, transaction, authorizer, operation }: OperationConfig<
    Flag, Return, ParamsSchema, DataSchema, PrismaWhereFilter
>): ServiceOperation<OpensTransactionOf<Flag>, Return, ParamsSchema, DataSchema, undefined> {
    return defineSubOperation<
        Return,
        Flag,
        ParamsSchema,
        DataSchema,
        undefined,
        undefined,
        undefined,
        PrismaWhereFilter
    >({
        transaction,
        operation: () => operation,
        paramsSchema: paramsSchema !== undefined ? () => paramsSchema : undefined,
        dataSchema: dataSchema !== undefined ? () => dataSchema : undefined,
    }).implement({
        authorizer,
        ownershipCheck: () => true,
        implementationParamsSchema: undefined,
        dataSchemaImplementationFields: undefined,
        paramsSchemaImplementationFields: undefined,
        operationImplementationFields: undefined,
    })
}

function operationOfEntry<
    Flag extends TransactionFlag,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    EntryRule extends Rule,
    Return,
>(
    entry: ContractEntry<unknown, ParamsSchema, DataSchema, EntryRule>,
    { transaction, authorizerData, operation }: EntryImplementation<Flag, Return, ParamsSchema, DataSchema, EntryRule>,
) {
    return operationOfConfig<Flag, Return, ParamsSchema, DataSchema, RuleFilter<EntryRule>>({
        paramsSchema: entry.params,
        dataSchema: entry.data,
        transaction,
        authorizer: async args => entry.authorizer.data(authorizerData ? await authorizerData(args) : {}),
        operation,
    })
}

export type SubServiceOperation<
    Return,
    Flag extends TransactionFlag = 'NONE',
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
    ParamsSchemaImplementationFields extends object | undefined = undefined,
    DataSchemaImplementationFields extends object | undefined = undefined,
    OperationImplementationFields extends object | undefined = undefined,
    PrismaWhereFilter extends object | undefined = undefined,
> = ReturnType<typeof subOperationOfConfig<
    Return,
    Flag,
    ParamsSchema,
    DataSchema,
    ParamsSchemaImplementationFields,
    DataSchemaImplementationFields,
    OperationImplementationFields,
    PrismaWhereFilter
>>

/**
 * The Prisma errors an operation may run into, and what each means to the user. The message ends
 * up as a general error in the form that was submitted, so it says what the user can do about it
 * rather than what the database objected to. Any code not listed here is an unknown error.
 */
const prismaErrorCodes: Record<string, [ServiceErrorCode, string]> = {
    // What was sent in
    P2000: ['BAD DATA', 'En av verdiene er for lang.'],
    P2002: ['DUPLICATE', 'Dette finnes allerede.'],
    P2003: ['BAD PARAMETERS', 'Det du viser til finnes ikke, eller noe annet avhenger av det.'],
    P2011: ['BAD DATA', 'Et påkrevd felt mangler.'],
    P2020: ['BAD DATA', 'En av verdiene er utenfor gyldig område.'],
    // What was looked up
    P2001: ['NOT FOUND', 'Fant ikke ressursen.'],
    P2015: ['NOT FOUND', 'Fant ikke det som skulle kobles til.'],
    P2018: ['NOT FOUND', 'Fant ikke det som skulle kobles til.'],
    P2025: ['NOT FOUND', 'Fant ikke ressursen.'],
    // Passing trouble on the database side, where trying again is the right response
    P2024: ['SERVER ERROR', 'Databasen svarte ikke i tide. Prøv igjen.'],
    P2028: ['SERVER ERROR', 'Operasjonen tok for lang tid. Prøv igjen.'],
    P2034: ['SERVER ERROR', 'Noen andre endret det samme samtidig. Prøv igjen.'],
}

/**
 * Runs one step of an operation and turns whatever it throws into a service error: a known Prisma
 * error becomes the service error it stands for (a unique violation is a DUPLICATE, a missing row
 * NOT FOUND), a service error passes through, and anything else is an UNKNOWN ERROR. So everything
 * an operation throws is a Smorekopp, which is what `makeAction` relies on.
 */
async function prismaErrorWrapper<Result>(call: () => Awaitable<Result>): Promise<Result> {
    try {
        return await call()
    } catch (error) {
        if (error instanceof Smorekopp) throw error

        if (!(error instanceof PrismaClientKnownRequestError)) {
            logger.error('Unknown error:', error)
            throw new ServiceError('UNKNOWN ERROR', 'En ukjent feil oppstod.')
        }

        const mapped = prismaErrorCodes[error.code]
        if (!mapped) {
            logger.error('Unknown prisma error:', error)
            throw new ServiceError('UNKNOWN ERROR', 'En ukjent databasefeil oppstod.')
        }

        // A missing row while seeding is expected - upsert() reads before it creates - and the tests
        // provoke these errors on purpose, so neither is logged.
        const expectedSeedNotFound = process.env.SEED === 'true' && error.code === 'P2025'
        if (process.env.NODE_ENV !== 'test' && !expectedSeedNotFound) {
            logger.error(error)
        }
        throw new ServiceError(mapped[0], mapped[1])
    }
}
