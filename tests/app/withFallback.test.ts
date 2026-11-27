import { withFallback } from '@/app/ServerPage'
import { ServiceError, Smorekopp } from '@/services/error'
import { describe, expect, test } from '@jest/globals'

describe('withFallback', () => {
    test('a service error gives the fallback, and a call that succeeds its own result', async () => {
        expect(await withFallback(Promise.reject(new Smorekopp('UNAUTHORIZED')), 'fallback')).toBe('fallback')
        expect(await withFallback(Promise.resolve('result'), 'fallback')).toBe('result')
    })

    test('limited to some codes, it gives the fallback on those and throws another service error on', async () => {
        const unauthorized = new Smorekopp('UNAUTHORIZED')

        expect(await withFallback(Promise.reject(new ServiceError('NOT FOUND', 'Fant ikke skapet')), null, ['NOT FOUND']))
            .toBeNull()
        await expect(withFallback(Promise.reject(unauthorized), null, ['NOT FOUND'])).rejects.toBe(unauthorized)
    })

    test('an error that is no service error is thrown on, since it is a bug', async () => {
        const bug = new TypeError('undefined is not a function')

        await expect(withFallback(Promise.reject(bug), 'fallback')).rejects.toBe(bug)
    })
})
