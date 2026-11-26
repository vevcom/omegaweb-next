import '@ow-server-only'
import { createActionError } from './actionError'
import { ParseError, Smorekopp } from './error'
import { ServerSession } from '@/auth/session/ServerSession'
import type { Action, ActionFromServiceOperation, ActionReturn } from './actionTypes'
import type { MarkOf } from './serviceContract'
import type { ServiceOperation } from '@/services/serviceOperation'
import type { z } from 'zod'

// The signature callers see. It takes the operation whole, so that the mark of a contract entry reaches its action.
export function makeAction<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Every operation is taken, whatever its schemas.
    Operation extends ServiceOperation<boolean, any, any, any, any>,
>(serviceOperation: Operation): ActionFromServiceOperation<Operation> & MarkOf<Operation>

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
            return createActionError(error.errorCode, error.parseError.error.issues)
        }
        if (error instanceof Smorekopp) {
            return createActionError(error.errorCode, error.errors)
        }
        return createActionError('UNKNOWN ERROR', 'unknown error')
    }
}
