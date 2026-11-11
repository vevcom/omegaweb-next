import { displayAmount } from '@/lib/currency/convert'
import { calculateCabinBookingPrice, calculateTotalCabinBookingPrice } from '@/services/cabin/booking/cabinPriceCalculator'
import type { CabinProductExtended } from '@/services/cabin/product/types'
import type { CabinPriceCalculatorReturnType } from '@/services/cabin/booking/cabinPriceCalculator'
import type { PricePeriod } from '@/prisma-generated-pn-types'


export default function CabinPriceCalculator({
    pricePeriods,
    products,
    productAmounts,
    startDate,
    endDate,
    numberOfMembers,
    numberOfNonMembers,
}: {
    pricePeriods: PricePeriod[],
    products: CabinProductExtended[],
    productAmounts: number[],
    startDate?: Date,
    endDate?: Date,
    numberOfMembers: number,
    numberOfNonMembers: number,
}) {
    if (products.length !== productAmounts.length) {
        throw new Error('Produktene og produktantallene må ha samme lengde')
    }
    let priceData: CabinPriceCalculatorReturnType[] = []
    let totalPrice = 0

    if (startDate && endDate) {
        priceData = calculateCabinBookingPrice({
            pricePeriods,
            products,
            productAmounts,
            startDate,
            endDate,
            numberOfMembers,
            numberOfNonMembers
        })
        totalPrice = calculateTotalCabinBookingPrice(priceData)
    }

    if (priceData.length === 0) {
        return <p className="m-0 text-base-content/80">Velg datoer for å se prisen.</p>
    }

    return <div className="flex flex-col gap-3">
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {priceData.map((priceRow, index) => (
                <li key={index} className="flex justify-between gap-3">
                    <span>
                        {priceRow.product.name}
                        {priceRow.productPrice.description && ` (${priceRow.productPrice.description})`}
                        <span className="block text-s text-base-content/70">
                            {priceRow.amount} × {displayAmount(priceRow.productPrice.price)}
                        </span>
                    </span>
                    <span className="whitespace-nowrap">
                        {displayAmount(priceRow.amount * priceRow.productPrice.price)}
                    </span>
                </li>
            ))}
        </ul>
        <div className="flex flex-wrap justify-between gap-x-3 pt-3 border-t border-base-300 text-l font-semibold">
            <span>Totalt</span>
            <span className="whitespace-nowrap">{displayAmount(totalPrice, false)}</span>
        </div>
    </div>
}
