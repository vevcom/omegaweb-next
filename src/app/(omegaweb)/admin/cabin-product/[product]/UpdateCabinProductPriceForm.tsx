'use client'
import { createCabinProductPriceAction } from '@/services/cabin/product/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/app/_components/Form/Form'
import NumberInput from '@/app/_components/UI/NumberInput'
import { SelectNumber } from '@/app/_components/UI/Select'
import TextInput from '@/app/_components/UI/TextInput'
import { displayDate } from '@/lib/dates/displayDate'
import type { BookingType, PricePeriod } from '@/prisma-generated-pn-types'


export function UpdateCabinProductPriceForm({
    productId,
    productType,
    pricePeriods,
}: {
    productId: number
    productType: BookingType,
    pricePeriods: PricePeriod[],
}) {
    if (pricePeriods.length === 0) {
        return <p>Det er ingen prisperioder som ikke er sluppet enda. Lag en ny pris periode før du oppdaterer prisene.</p>
    }
    return <Form
        action={configureAction(createCabinProductPriceAction, { params: { cabinProductId: productId } })}
        submitText="Legg til pris"
    >
        <TextInput name="description" label="Beskrivelse" />
        <NumberInput name="price" label="Pris" defaultValue={100} min={0} />
        <TextInput name="cronInterval" label="Cron intervall for gyldighet" defaultValue="* * *" />
        {productType === 'CABIN' &&
            <NumberInput name="memberShare" label="Medlemsandel" defaultValue={0} />
        }
        {productType !== 'CABIN' &&
            <input type="hidden" name="memberShare" value={0} />
        }
        <SelectNumber
            options={pricePeriods.map(period => ({
                value: period.id,
                label: displayDate(period.validFrom, false),
            }))}
            name="pricePeriodId"
            label="Pris periode"
        />
    </Form>
}
