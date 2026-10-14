import { getHttpErrorCode } from '@/services/error'
import type { ErrorCode, ErrorMessage } from '@/services/error'
import type { ActionError } from './actionTypes'

/**
 * The error half of an `ActionReturn`. An action made with `makeAction` builds it from what the
 * operation threw; this is for client code that produces an `ActionReturn` of its own, such as a
 * submit handler that also talks to Stripe, or a check that fails before any action is called.
 */
export function createActionError(errorCode: ErrorCode, error?: string | ErrorMessage[]): ActionError {
    return {
        success: false,
        errorCode,
        httpCode: getHttpErrorCode(errorCode),
        error: typeof error === 'string' ? [{ message: error }] : error,
    }
}
