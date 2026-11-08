import { paymentDeadline } from '@/services/events/registration/paymentDeadline'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const at = (hours: number) => new Date(Date.UTC(2026, 0, 1) + hours * HOUR)

describe('paymentDeadline', () => {
    test('without a promotion the deadline is the end of the payment period', () => {
        expect(paymentDeadline(at(0), at(48), null)).toEqual(at(48))
    })

    test('a late promotion gets 24 hours past the end', () => {
        expect(paymentDeadline(at(0), at(48), at(40))).toEqual(at(64))
    })

    test('a promotion before payment opens gets 24 hours from the opening', () => {
        expect(paymentDeadline(at(20), at(22), at(0))).toEqual(at(44))
    })

    test('an early promotion keeps the end of the payment period when it is later', () => {
        expect(paymentDeadline(at(0), at(100), at(10))).toEqual(at(100))
    })
})
