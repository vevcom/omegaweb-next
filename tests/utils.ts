import { jest } from '@jest/globals'
import type Mail from 'nodemailer/lib/mailer'

/**
 * Waits for all promises to settle and returns their results.
 * Throws an error if any promise rejects, with `cause` containing all rejection reasons.
 *
 * This is useful for ensuring that all asynchronous operations complete before proceeding.
 * Specifically, in cases where multiple database operations are ongoing even if one fails.
 *
 * @param promises Array of promises to wait for.
 * @returns Resolved values of all fulfilled promises.
 * @throws {Error} If any promise rejects.
 */
export async function allSettledOrThrow<T>(promises: Promise<T>[]): Promise<T[]> {
    const results = await Promise.allSettled(promises)

    const rejected = results.filter(result => result.status === 'rejected')
    rejected.forEach(result => {
        console.error('Promise rejected:', result.reason)
    })
    if (rejected.length > 0) {
        throw new Error('Some promises rejected.', {
            cause: rejected.map(result => result.reason),
        })
    }

    const fulfilled = results.filter(result => result.status === 'fulfilled')
    return fulfilled.map(result => result.value)
}

/**
 * Swaps the mail handler for one that only records the mail it is handed, so a test can check
 * what an operation sends without sending anything. Swapping the handler, rather than mocking the
 * module sending through it, also catches mail from modules the seeding already loaded.
 *
 * @returns The mock every single mail is handed to.
 */
export function recordSentMail() {
    const sendSingleMail = jest.fn<(mail: Mail.Options) => Promise<void>>(async () => {})
    global.mailHandler = {
        sendSingleMail,
        sendBulkMail: jest.fn(async () => {}),
    } as unknown as typeof global.mailHandler
    return sendSingleMail
}
