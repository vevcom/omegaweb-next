import NumberInput from '@/app/_components/UI/NumberInput'
import type { CabinProductExtended } from '@/services/cabin/product/types'


export default function SelectBedProducts({
    bedProducts,
    onChange,
    amounts,
}: {
    bedProducts: CabinProductExtended[],
    onChange: (product: number[]) => void
    amounts: number[],
}) {
    if (bedProducts.length === 0) {
        throw new Error('Ingen produkter av den gitte typen')
    }

    return <>
        {bedProducts.map((product, index) =>
            <NumberInput
                key={index}
                name={`product-${product.id}`}
                label={product.name}
                value={amounts[index]}
                onChange={(e) => {
                    const value = Number(e.target.value)
                    if (value >= 0 && value <= product.amount) {
                        const newAmounts = [...amounts]
                        newAmounts[index] = value
                        onChange(newAmounts)
                    }
                }}
            />
        )}
    </>
}
