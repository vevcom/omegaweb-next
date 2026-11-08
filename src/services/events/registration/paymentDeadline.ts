export const PAYMENT_HOURS_AFTER_PROMOTION = 24

/**
 * Someone let in from the waiting list late still gets time to pay, even past the variant's end.
 * The time counts from when payment opens, so someone let in before that gets all of it.
 */
export function paymentDeadline(paymentStart: Date, paymentEnd: Date, promotedAt: Date | null) {
    if (!promotedAt) return paymentEnd
    const windowStart = Math.max(promotedAt.getTime(), paymentStart.getTime())
    const afterPromotion = windowStart + PAYMENT_HOURS_AFTER_PROMOTION * 60 * 60 * 1000
    return new Date(Math.max(paymentEnd.getTime(), afterPromotion))
}
