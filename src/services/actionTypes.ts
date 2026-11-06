import type { SubServiceOperation, ServiceOperation } from '@/services/serviceOperation'
import type { ErrorMessage, ErrorCode } from '@/services/error'
import type { z } from 'zod'

/**
 * The return type of an action on error.
 */
export type ActionError = {
    success: false,
    errorCode: ErrorCode,
    httpCode: number,
    error?: ErrorMessage[],
}

/**
 * The return type of an action on success.
 */
export type ActionData<T = undefined> = {
    success: true,
    data: T,
}

/**
 * The return type of an action. Either success with data or error with error info.
 */
export type ActionReturn<T = undefined> = ActionData<T> | ActionError

/**
 * Type for an action with implementation params and params finished bound (configured). This type
 * also only accesses the form data not ```{ data: z.input<DataSchema> }```
 */
export type ActionFormData<T = undefined> = (formData: FormData) => Promise<ActionReturn<T>>

export type Action<
    Return,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined,
    ParamsSchema extends z.ZodTypeAny | undefined,
    DataSchema extends z.ZodTypeAny | undefined,
> = (
    ImplementationParamsSchema extends z.ZodTypeAny ? (
        ParamsSchema extends z.ZodTypeAny ? (
            DataSchema extends z.ZodTypeAny ? (
                (
                    implementationParams: { implementationParams: z.input<ImplementationParamsSchema> },
                    params: { params: z.input<ParamsSchema> },
                    data: { data: z.input<DataSchema> } | FormData
                ) => Promise<ActionReturn<Return>>
            ) : (
                (
                    implementationParams: { implementationParams: z.input<ImplementationParamsSchema> },
                    params: { params: z.input<ParamsSchema> },
                ) => Promise<ActionReturn<Return>>
            )
        ) : (
        DataSchema extends z.ZodTypeAny ? (
                (
                    implementationParams: { implementationParams: z.input<ImplementationParamsSchema> },
                    params: { params: undefined },
                    data: { data: z.input<DataSchema> } | FormData
                ) => Promise<ActionReturn<Return>>
            ) : (
                (
                    implementationParamsSchema: {
                        implementationParamsSchema: z.input<ImplementationParamsSchema>
                    },
                ) => Promise<ActionReturn<Return>>
            )
        )
    ) : (
        ParamsSchema extends z.ZodTypeAny ? (
            DataSchema extends z.ZodTypeAny ? (
                (
                    params: { params: z.input<ParamsSchema> },
                    data: { data: z.input<DataSchema> } | FormData
                ) => Promise<ActionReturn<Return>>
            ) : (
                (
                    params: { params: z.input<ParamsSchema> },
                ) => Promise<ActionReturn<Return>>
            )
        ) : (
            DataSchema extends z.ZodTypeAny ? (
                (
                    data: { data: z.input<DataSchema> } | FormData
                ) => Promise<ActionReturn<Return>>
            ) : (
                () => Promise<ActionReturn<Return>>
            )
        )
    )
)


/**
 * Utility type to extract the action function type from a service operation.
 *
 * Takes a finished implemented service operation and returns the type of the
 * function that makeAction would return for it.
 *
 * @example
 * ```typescript
 * const myOperation = defineOperation({...}).implement({...})
 * type MyActionType = ActionFromServiceOperation<typeof myOperation>
 * // MyActionType is now the function type with correct parameters and ActionReturn
 * ```
 */
export type ActionFromServiceOperation<T> =
    T extends ServiceOperation<
        boolean,
        infer Return,
        infer ParamsSchema,
        infer DataSchema,
        infer ImplementationParamsSchema
    > ? Action<Return, ImplementationParamsSchema, ParamsSchema, DataSchema> : 'FAILED_SERVICE_MATCH'

/**
 * This type extracts the action function type from a sub-service operation.
 * It will not include the implementation params as first argument as it is not known from a sub-service operation.
 * It is assumed to be undefined
 */
export type ActionFromSubServiceOperation<
    T,
> = T extends SubServiceOperation<
    infer Return,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    infer Flag,
    infer ParamsSchema,
    infer DataSchema,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    infer ParamsSchemaImplementationFields,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    infer DataSchemaImplementationFields,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    infer OperationImplementationFields
> ? Action<Return, undefined, ParamsSchema, DataSchema> : 'FAILED_SUBSERVICE_MATCH'

export type ConfiguredAction<
    ActionFcn
> = ActionFcn extends (
        p: infer P extends { params: infer Params } | { implementationParams: infer ImplementationParams },
        ...rest: infer D) => infer R ? (
    (...rest: D) => R
) : 'FAILED_ACTION_MATCH'
