import { serviceErrorOf } from '@/app/ServerPage'
import { ServiceError, Smorekopp } from '@/services/error'
import { describe, expect, test } from '@jest/globals'

function thrownBy(run: () => unknown): unknown {
    try {
        run()
    } catch (error) {
        return error
    }
    throw new Error('Nothing was thrown')
}

describe('serviceErrorOf', () => {
    test('a service error comes back as it is', () => {
        const unauthorized = new Smorekopp('UNAUTHORIZED')
        const notFoundError = new ServiceError('NOT FOUND', 'Fant ikke kontoen')

        expect(serviceErrorOf(unauthorized)).toBe(unauthorized)
        expect(serviceErrorOf(notFoundError)).toBe(notFoundError)
    })

    test('an error that is no service error is thrown on, since it is a bug', () => {
        const bug = new TypeError('undefined is not a function')

        expect(thrownBy(() => serviceErrorOf(bug))).toBe(bug)
        expect(thrownBy(() => serviceErrorOf('a string that was thrown'))).toBe('a string that was thrown')
    })
})
