import { Session } from '@/auth/session/Session'
import { jest } from '@jest/globals'
import type Mail from 'nodemailer/lib/mailer'
import type { AnySession, SessionMaybeUser } from '@/auth/session/Session'
import type { Permission } from '@/prisma-generated-pn-types'
import type { MembershipFiltered } from '@/services/groups/types'
import type { UserFiltered } from '@/services/users/types'

/**
 * A session for a test, from parts that need not hang together the way a real session's do. A real
 * session only has memberships when it has a user, and the type of a session says so. A test of a
 * rule on memberships seldom needs the user they belong to, so here it may be left out.
 */
export function testSession(parts: {
    user?: UserFiltered | null,
    permissions?: Permission[],
    memberships?: MembershipFiltered[],
}): AnySession {
    return Session.fromJsObject({
        user: parts.user ?? null,
        permissions: parts.permissions ?? [],
        memberships: parts.memberships ?? [],
    } as SessionMaybeUser)
}

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
    const reasons = rejected.map((result): unknown => result.reason)
    reasons.forEach(reason => {
        console.error('Promise rejected:', reason)
    })
    if (reasons.length > 0) {
        throw new Error('Some promises rejected.', {
            cause: reasons,
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

/**
 * Waits until `condition` holds, for work a test started without a promise to await, such as a mail
 * sent in the background. Throws when it has not come to hold within the timeout.
 */
export async function waitUntil(condition: () => boolean, timeoutMs = 4000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('Waited for something that did not happen in time')
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}
