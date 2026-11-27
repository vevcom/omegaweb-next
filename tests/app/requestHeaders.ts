import { jest } from '@jest/globals'

export const requestPath = '/users/harambe/account'

/**
 * Next fills the headers of a request only for one it serves itself, and the redirect to the login
 * reads the page it is on from them. A test imports this before what it tests, since the mock must
 * be in place when the code under test is loaded.
 */
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(new Headers({ host: 'omega.ntnu.no', 'x-current-path': requestPath })),
}))
