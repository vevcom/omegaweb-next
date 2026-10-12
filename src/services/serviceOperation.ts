import '@pn-server-only'
import { ParseError, Smorekopp } from './error'
import { prismaErrorWrapper } from './prismaCall'
import { prisma as globalPrisma } from '@/prisma-pn-client-instance'
import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import logger from '@/lib/logger'
import { zfd } from 'zod-form-data'
import { AsyncLocalStorage } from 'async_hooks'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { z } from 'zod'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Prisma, PrismaClient } from '@/prisma-generated-pn-client'

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
) => Promise<Return> | Return

export type SubServiceOperationConfig<
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    Return,
    OpensTransaction extends boolean = false,
    PrismaWhereFilter extends object | undefined = undefined
> = {
    paramsSchema?: ((implementationFields: ParamsSchemaImplementationFields) => ParamsSchema) | undefined,
    dataSchema?: ((implementationFields: DataSchemaImplementationFields) => DataSchema) | undefined,
    opensTransaction?: OpensTransaction,
    operation: (implementationFields: OperationImplementationFields) =>
        ServiceOperationOperation<OpensTransaction, ParamsSchema, DataSchema, Return, PrismaWhereFilter>
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
        | Authorizer<
            'USER_NOT_REQUIRED_FOR_AUTHORIZED' | 'USER_REQUIRED_FOR_AUTHORIZED', PrismaWhereFilter
        > | Promise<
            Authorizer<
                'USER_NOT_REQUIRED_FOR_AUTHORIZED' | 'USER_REQUIRED_FOR_AUTHORIZED', PrismaWhereFilter
            >
        >

export type OwnershipCheck<
    OpensTransaction extends boolean,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
> = (
    args: ArgsAuthGetterAndOwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>
) => boolean | Promise<boolean>

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
) => void | Promise<void>

export type ServiceOperationImplementationConfigInternalCall<
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
> = {
    implementationParamsSchema?: ImplementationParamsSchema,
    paramsSchemaImplementationFields?: ParamsSchemaImplementationFields
    dataSchemaImplementationFields?: DataSchemaImplementationFields
    operationImplementationFields?: OperationImplementationFields
} & (ParamsSchemaImplementationFields extends undefined ?
    object
    : {
        paramsSchemaImplementationFields: ParamsSchemaImplementationFields
    }) & (DataSchemaImplementationFields extends undefined ?
        object
        : {
            dataSchemaImplementationFields: DataSchemaImplementationFields
        }) & (OperationImplementationFields extends undefined ?
            object
            : {
                operationImplementationFields: OperationImplementationFields
            })

export type ServiceOperationImplementationConfig<
    OpensTransaction extends boolean,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
    ParamsSchemaImplementationFields extends object | undefined,
    DataSchemaImplementationFields extends object | undefined,
    OperationImplementationFields extends object | undefined,
    PrismaWhereFilter extends object | undefined
> = ServiceOperationImplementationConfigInternalCall<
    ImplementationParamsSchema,
    ParamsSchemaImplementationFields,
    DataSchemaImplementationFields,
    OperationImplementationFields
> & {
    authorizer: AuthorizerGetter<
        OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema, PrismaWhereFilter | undefined
    >,
    ownershipCheck: OwnershipCheck<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>,
    beforeRun?: BeforeRun<OpensTransaction, ParamsSchema, DataSchema, ImplementationParamsSchema>,
}

/**
 * This is the type for the prisma client that is passed to the service operation.
 * It can't simply be PrismaClient because it can be usefull to use a service operation
 * inside a transaction. In that case, the prisma client is a Prisma.TransactionClient.
 * The caveat is that a Prisma.TransactionClient can't be used to open a new transaction
 * so if the service operation opens a transaction, the prisma client can only be a PrismaClient.
 *
 * The check is written as [OpensTransaction] extends [true] rather than the bare
 * OpensTransaction extends true so that it does not distribute over a union. An operation that
 * does not declare opensTransaction gets `boolean` here, and a distributing conditional turns that
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
export function withServiceContext<T, OpensTransaction extends boolean>(
    contextOverride: Partial<ServiceOperationContext<OpensTransaction>>,
    opensTransaction: OpensTransaction | undefined,
    callback: (context: ServiceOperationContext<OpensTransaction>) => T,
): T {
    const localContext = asyncLocalStorage.getStore()

    const isAppropriateClient = (
        prisma: PrismaClient | Prisma.TransactionClient
    ): prisma is PrismaPossibleTransaction<OpensTransaction> =>
        !opensTransaction || '$transaction' in prisma

    const prisma = contextOverride.prisma ?? localContext?.prisma ?? globalPrisma
    if (!isAppropriateClient(prisma)) {
        throw new Smorekopp(
            'SERVER ERROR',
            `Service operation is configured to open a transaction,
            but the prisma client in the context is a transaction client.`
        )
    }

    const context: ServiceOperationContext<OpensTransaction> = {
        prisma,
        session: contextOverride.session ?? localContext?.session ?? Session.empty(),
        bypassAuth: contextOverride.bypassAuth ?? localContext?.bypassAuth ?? false,
    }

    return asyncLocalStorage.run(context, () => callback(context))
}


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
            & ServiceOperationExecuteArgs<Unsafe, ParamsSchema, DataSchema, ImplementationParamsSchema>
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
    OpensTransaction extends boolean = false,
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
        OpensTransaction,
        PrismaWhereFilter
    >
) {
    const implement = <ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined>(
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
                    // TODO: This needs to be returned to give good error message.
                    logger.debug('Service operation params failed validation.', { paramsParse })
                    throw new Smorekopp('BAD PARAMETERS', 'Invalid params passed to service operation.')
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
                const dataParse = zfd.formData(dataSchema).safeParse(args.data)
                if (!dataParse.success) {
                    if (process.env.NODE_ENV !== 'test') {
                        logger.debug('Service operation data failed validation.', { dataParse })
                    }
                    throw new ParseError(dataParse)
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
                    // TODO: This needs to be returned to give good error message.
                    logger.info('Service operation implementation params failed validation.', { implementationParamsParse })
                    throw new Smorekopp('BAD PARAMETERS', 'Invalid implementation params passed to service operation.')
                }
                args.implementationParams = implementationParamsParse.data
            }

            if (!expectedArgsArePresent(args)) {
                throw new Smorekopp(
                    'SERVER ERROR',
                    'Service operation recieved invalid arguments.'
                )
            }

            // Then, get the context (which includes the prisma client, the session and the bypassAuth flag).
            // If a context override is provided, use it. Otherwise, use the context from the async local storage.
            // If there is no context in the async local storage, use global defaults.
            return withServiceContext(
                context,
                serviceOperationConfig.opensTransaction,
                async ({ prisma, bypassAuth, session }) => {
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
                                throw new Smorekopp(authResult.status, authResult.getErrorMessage)
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

                    return prismaErrorWrapper(() =>
                        serviceOperationConfig.operation(
                            implementationArgs.operationImplementationFields!
                        )({ ...args, prisma, bypassAuth, session }, prismaWhereFilter)
                    )
                })
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
    OpensTransaction extends boolean,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
    PrismaWhereFilter extends object | undefined = undefined
>({ paramsSchema, dataSchema, opensTransaction, authorizer, operation }: {
    paramsSchema?: ParamsSchema,
    dataSchema?: DataSchema,
    opensTransaction?: OpensTransaction,
    authorizer: AuthorizerGetter<OpensTransaction, ParamsSchema, DataSchema, undefined, PrismaWhereFilter | undefined>,
    operation: ServiceOperationOperation<OpensTransaction, ParamsSchema, DataSchema, Return, PrismaWhereFilter>
}): ServiceOperation<OpensTransaction, Return, ParamsSchema, DataSchema, undefined> {
    return defineSubOperation<
        Return,
        OpensTransaction,
        ParamsSchema,
        DataSchema,
        undefined,
        undefined,
        undefined,
        PrismaWhereFilter
    >({
        opensTransaction,
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

export type SubServiceOperation<
    Return,
    OpensTransaction extends boolean = false,
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
    ParamsSchemaImplementationFields extends object | undefined = undefined,
    DataSchemaImplementationFields extends object | undefined = undefined,
    OperationImplementationFields extends object | undefined = undefined,
> = ReturnType<typeof defineSubOperation<
    Return,
    OpensTransaction,
    ParamsSchema,
    DataSchema,
    ParamsSchemaImplementationFields,
    DataSchemaImplementationFields,
    OperationImplementationFields
>>
