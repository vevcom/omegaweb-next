import { currencySymbol } from './config'

export function convertAmount(amount: string | number): number {
    if (typeof amount === 'string') {
        amount = amount.replace(',', '.')
    }

    return Math.round(Number(amount) * 100)
}

export function displayAmount(amount: number, short: boolean = true, withSign: boolean = false): string {
    const convertedAmount = amount / 100
    const amountString = convertedAmount.toFixed(2)

    // For negative numbers '-' is already prefixed.
    const sign = withSign && convertedAmount > 0 ? '+' : ''

    if (short) return `${sign}${amountString}`

    return `${sign}${amountString} ${currencySymbol}`
}
