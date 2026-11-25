import { requeueNotice } from '@/services/events/registration/requeueNotice'
import { describe, expect, test } from '@jest/globals'
import type { PaymentStatus } from '@/services/events/registration/paymentStatus'

const HOUR = 60 * 60 * 1000
const at = (hours: number) => new Date(Date.UTC(2026, 0, 1) + hours * HOUR)

const paymentEnd = at(48)
const eventStart = at(100)

const noticeAt = (now: Date, status: PaymentStatus, {
    deadline = paymentEnd,
    registeredAt = status === 'NOT_REGISTERED' ? null : at(0),
    requeueUnpaidRegistrations = true,
}: { deadline?: Date, registeredAt?: Date | null, requeueUnpaidRegistrations?: boolean } = {}) => requeueNotice({
    requeueUnpaidRegistrations,
    status,
    deadline,
    paymentEnd,
    eventStart,
    registeredAt,
    now,
})

describe('requeueNotice', () => {
    test('a visitor sees the policy before registering', () => {
        expect(noticeAt(at(10), 'NOT_REGISTERED')).toBe('BEFORE_DEADLINE')
    })

    test('a visitor is not told of it once the payment period is over', () => {
        expect(noticeAt(at(60), 'NOT_REGISTERED')).toBeNull()
    })

    test('an unpaid registration is told before its deadline', () => {
        expect(noticeAt(at(10), 'UNPAID')).toBe('BEFORE_DEADLINE')
        expect(noticeAt(paymentEnd, 'UNPAID')).toBe('BEFORE_DEADLINE')
    })

    test('an unpaid registration is still told after its deadline, until the event starts', () => {
        expect(noticeAt(at(60), 'UNPAID')).toBe('AFTER_DEADLINE')
        expect(noticeAt(eventStart, 'UNPAID')).toBeNull()
    })

    test('a late promotion is told before and after its own deadline', () => {
        const promoted = { deadline: at(74), registeredAt: at(49) }
        expect(noticeAt(at(60), 'UNPAID', promoted)).toBe('BEFORE_DEADLINE')
        expect(noticeAt(at(80), 'UNPAID', promoted)).toBe('AFTER_DEADLINE')
    })

    test('a registration made after the payment period is left to the administrators', () => {
        expect(noticeAt(at(60), 'UNPAID', { registeredAt: at(55) })).toBeNull()
    })

    test('a deadline after the event starts can never be acted on', () => {
        expect(noticeAt(at(90), 'UNPAID', { deadline: at(110), registeredAt: at(80) })).toBeNull()
    })

    test('paid and waiting registrations are not told', () => {
        expect(noticeAt(at(10), 'PAID')).toBeNull()
        expect(noticeAt(at(60), 'PAID')).toBeNull()
        expect(noticeAt(at(10), 'WAITING_LIST')).toBeNull()
    })

    test('nothing is said when the variant does not requeue', () => {
        expect(noticeAt(at(10), 'NOT_REGISTERED', { requeueUnpaidRegistrations: false })).toBeNull()
        expect(noticeAt(at(10), 'UNPAID', { requeueUnpaidRegistrations: false })).toBeNull()
        expect(noticeAt(at(60), 'UNPAID', { requeueUnpaidRegistrations: false })).toBeNull()
    })
})
