export const PAYMENT_HOURS_AFTER_PROMOTION = 24

/** Someone let in from the waiting list late still gets time to pay, even past the variant's end. */
export function paymentDeadline(paymentEnd: Date, promotedAt: Date | null) {
    if (!promotedAt) return paymentEnd
    const afterPromotion = promotedAt.getTime() + PAYMENT_HOURS_AFTER_PROMOTION * 60 * 60 * 1000
    return new Date(Math.max(paymentEnd.getTime(), afterPromotion))
}
