import { ServiceError, Smorekopp } from './error'
import logger from '@/lib/logger'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { ServiceErrorCode } from './error'

const errorMessagesMap: { [key: string]: [ServiceErrorCode, string] } = {
    P2002: ['DUPLICATE', 'duplicate entry'],
    P2025: ['NOT FOUND', 'not found'],
}

/**
 * A function that translates prisma calls into ServerErorrs if they throw errors
 *
 * THIS FUNCTION HAS BEEN DEPRECATED IN FAVOR OF prismaErrorWrapper
 *
 * @deprecated
 * @param call - An async prisma function to call.
 * @returns
 */
export async function prismaCall<T>(call: () => T | Promise<T>): Promise<T> {
    try {
        return await call()
    } catch (error) {
        if (error instanceof Smorekopp) {
            throw error
        }

        //TODO: Make logging of errors much better
        // A P2025 (not found) during seeding is expected self-heal noise - upsert() treats it as
        // "doesn't exist yet, create it" - so it's silenced here instead of printing a scary raw
        // Prisma error for something that isn't actually a failure. Other errors still log even
        // during seeding, since those are real problems.
        const isSeedExpectedNotFound = process.env.SEED === 'true'
            && error instanceof PrismaClientKnownRequestError
            && error.code === 'P2025'

        if (process.env.NODE_ENV !== 'test' && !isSeedExpectedNotFound) {
            // TODO: Add the details from the error to the ServiceError
            logger.error(error)
        }

        if (!(error instanceof PrismaClientKnownRequestError)) {
            logger.error('Unknown error:', error)
            throw new ServiceError('UNKNOWN ERROR', 'unknown error')
        }

        const pError = errorMessagesMap[error.code]
        if (pError) throw new ServiceError(pError[0], pError[1])
        logger.error('Unknown prisma error:', error)
        throw new ServiceError('UNKNOWN ERROR', 'unknown prisma error')
    }
}

//TODO: Remove prismaCall and use prismaErrorWrapper instead - this is handled implicitly through
// the use of operations

/**
 * A function that wraps a prisma call in a try catch block and throws a ServiceError if it fails.
 * It translates prisma errors into ServiceErrors.
 * Further unknown errors are thrown as UNKNOWN ServiceErrors.
 * When wrapped in this you make sure all thrown errors are of type ServiceError
 * @param call - The function to be wrapped
 * @returns
 */
export async function prismaErrorWrapper<T>(
    call: () => T | Promise<T>,
) {
    return await prismaCall(call)
}
