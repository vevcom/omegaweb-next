import '@pn-server-only'
import { createActionError } from './actionError'
import { ParseError, Smorekopp } from './error'
import { ServerSession } from '@/auth/session/ServerSession'
import type { Action, ActionReturn } from './actionTypes'
import type { ServiceOperation } from '@/services/serviceOperation'
import type { z } from 'zod'

// This function is overloaded to allow for different combinations of parameters and data.

export function makeAction<
    Return,
>(
    serviceOperation: ServiceOperation<boolean, Return, undefined, undefined, undefined>
): Action<Return, undefined, undefined, undefined>

export function makeAction<
    Return,
    ImplementationParamsSchema extends z.ZodTypeAny,
>(
    serviceOperation: ServiceOperation<boolean, Return, undefined, undefined, ImplementationParamsSchema>
): Action<Return, ImplementationParamsSchema, undefined, undefined>

export function makeAction<
    Return,
    ParamsSchema extends z.ZodTypeAny,
>(
    serviceOperation: ServiceOperation<boolean, Return, ParamsSchema, undefined, undefined>
): Action<Return, undefined, ParamsSchema, undefined>

export function makeAction<
    Return,
    DataSchema extends z.ZodTypeAny
>(
    serviceOperation: ServiceOperation<boolean, Return, undefined, DataSchema, undefined>
): Action<Return, undefined, undefined, DataSchema>

export function makeAction<
    Return,
    ImplementationParamsSchema extends z.ZodTypeAny,
    ParamsSchema extends z.ZodTypeAny,
>(
    serviceOperation: ServiceOperation<boolean, Return, ParamsSchema, undefined, ImplementationParamsSchema>
): Action<Return, ImplementationParamsSchema, ParamsSchema, undefined>

export function makeAction<
    Return,
    ParamsSchema extends z.ZodTypeAny,
    DataSchema extends z.ZodTypeAny
>(
    serviceOperation: ServiceOperation<boolean, Return, ParamsSchema, DataSchema, undefined>
): Action<Return, undefined, ParamsSchema, DataSchema>

export function makeAction<
    Return,
    ImplementationParamsSchema extends z.ZodTypeAny,
    DataSchema extends z.ZodTypeAny
>(
    serviceOperation: ServiceOperation<boolean, Return, undefined, DataSchema, ImplementationParamsSchema>
): Action<Return, ImplementationParamsSchema, undefined, DataSchema>

export function makeAction<
    Return,
    ImplementationParamsSchema extends z.ZodTypeAny,
    ParamsSchema extends z.ZodTypeAny,
    DataSchema extends z.ZodTypeAny
>(
    serviceOperation: ServiceOperation<boolean, Return, ParamsSchema, DataSchema, ImplementationParamsSchema>
): Action<Return, ImplementationParamsSchema, ParamsSchema, DataSchema>


/**
 * Turn a service operation into suitable function for an action.
 *
 * @param serviceOperation - The service operation to create an action for.
 * @returns - A function that takes in data (which may be FormData) and/or/nor parameters and calls the service operation.
 */
export function makeAction<
    Return,
    ImplementationParamsSchema extends z.ZodTypeAny | undefined = undefined,
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined
>(
    serviceOperation: ServiceOperation<boolean, Return, ParamsSchema, DataSchema, ImplementationParamsSchema>
): Action<Return, ImplementationParamsSchema, ParamsSchema, DataSchema> {
    // Letting the arguments to the actual function be unknown is safer as anything can be passed to it form the client.
    // The action and service operation will validate the parameter and data before it is used.
    //
    // For convinience this function is given a return type that is more specific. The return type is a function that
    // has arguments witch match the underlying service operation. This makes programming easier as intellisesne can
    // help and errors are caught at compile time.
    const actionUnsafe = async (
        implementationParams: { implementationParams: unknown },
        params: { params: unknown },
        data: { data: unknown } | FormData,
    ): Promise<ActionReturn<Return>> => {
        const session = await ServerSession.fromNextAuth()

        let processedData: unknown
        if (data instanceof FormData) {
            // Treat empty form data as undefined. This is required because the form component will always send
            // a FormData instance, even if no data is being sent.
            if (data.entries().next().done) {
                processedData = undefined
            } else {
                processedData = data
            }
        } else {
            processedData = data?.data ?? undefined
        }

        return safeServerCall(
            () => serviceOperation<'UNSAFE'>({
                session,
                params: params?.params,
                data: processedData,
                implementationParams: implementationParams?.implementationParams
            })
        )
    }

    if (serviceOperation.implementationParamsSchema) {
        return actionUnsafe as Action<Return, ImplementationParamsSchema, ParamsSchema, DataSchema>
    }

    if (serviceOperation.paramsSchema) {
        return (
            actionUnsafe.bind(null, { implementationParams: undefined }) as
            Action<Return, ImplementationParamsSchema, ParamsSchema, DataSchema>
        )
    }

    return (
        actionUnsafe.bind(null, { implementationParams: undefined }, { params: undefined }) as
        Action<Return, ImplementationParamsSchema, ParamsSchema, DataSchema>
    )
}

/**
 * Runs the operation and turns its outcome into an `ActionReturn`: the data on success, the error
 * the action reports otherwise. Everything an operation throws is a Smorekopp (see
 * `prismaErrorWrapper` in serviceOperation.ts), so anything else is reported as unknown.
 */
async function safeServerCall<Return>(call: () => Promise<Return>): Promise<ActionReturn<Return>> {
    try {
        return { success: true, data: await call() }
    } catch (error) {
        if (error instanceof ParseError) {
            return createActionError('BAD PARAMETERS', error.parseError.error.issues)
        }
        if (error instanceof Smorekopp) {
            // An authorizer that passes never throws, so the two passing statuses exist only in the type.
            const errorCode = error.errorCode === 'AUTHORIZED' || error.errorCode === 'AUTHORIZED_NO_USER'
                ? 'UNKNOWN ERROR'
                : error.errorCode
            return createActionError(errorCode, error.errors)
        }
        return createActionError('UNKNOWN ERROR', 'unknown error')
    }
}
