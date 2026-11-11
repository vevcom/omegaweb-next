'use client'
import { useEventVariantsField } from './EventVariantsField'
import DateInput from '@/components/UI/DateInput'
import NumberInput from '@/components/UI/NumberInput'
import { SelectNumberPossibleNULL } from '@/components/UI/Select'
import Slider from '@/components/UI/Slider'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

type Account = Pick<LedgerAccount, 'id' | 'name'>

const accountName = (account: Account) => account.name ?? `Konto ${account.id}`

/**
 * What each variant costs, edited in the `EventVariantsField` around the form, and the account the
 * event is paid into, which is a field of its own.
 */
export default function EventPaymentFields({ ledgerAccount, ledgerAccounts }: {
    /** The account the event is linked to now, if any. */
    ledgerAccount: Account | null,
    /** The group accounts the session may link the event to. */
    ledgerAccounts: Account[],
}) {
    const { variants, changeVariant } = useEventVariantsField()
    if (variants.length === 0) {
        return <p className="m-0 text-base-content/80">
            Arrangementet har ikke påmelding, så det er ingenting å betale for.
        </p>
    }

    return <div className="flex flex-col gap-4 min-w-0 pb-4">
        {variants.map(variant => <section key={variant.key} className="flex flex-col gap-3 p-4 rounded-round bg-base-200">
            <Slider
                label={variants.length > 1 ? `${variant.name} koster penger` : 'Påmeldingen koster penger'}
                name={`takesPayment${variant.key}`}
                checked={variant.takesPayment}
                onChange={event => changeVariant(variant.key, {
                    takesPayment: event.target.checked,
                    paymentStart: variant.paymentStart ?? variant.registrationStart,
                    paymentEnd: variant.paymentEnd ?? variant.registrationEnd,
                })}
            />
            {variant.takesPayment && <div className="
                grid grid-cols-2 gap-x-4
                max-mobile:grid-cols-1
            ">
                <NumberInput
                    label="Pris i kroner"
                    name={`price${variant.key}`}
                    min={0}
                    value={variant.price ?? ''}
                    onChange={event => changeVariant(variant.key, { price: Number(event.target.value) })}
                    className="col-span-full"
                />
                <DateInput
                    label="Betaling åpner"
                    name={`paymentStart${variant.key}`}
                    includeTime
                    defaultValue={variant.paymentStart}
                    onChange={event => {
                        if (event.target.value) changeVariant(variant.key, { paymentStart: new Date(event.target.value) })
                    }}
                />
                <DateInput
                    label="Betalingsfrist"
                    name={`paymentEnd${variant.key}`}
                    includeTime
                    defaultValue={variant.paymentEnd}
                    onChange={event => {
                        if (event.target.value) changeVariant(variant.key, { paymentEnd: new Date(event.target.value) })
                    }}
                />
                <Slider
                    label="Flytt ubetalte bakerst på ventelisten"
                    name={`requeueUnpaidRegistrations${variant.key}`}
                    checked={variant.requeueUnpaidRegistrations}
                    onChange={event => changeVariant(variant.key, { requeueUnpaidRegistrations: event.target.checked })}
                    className="col-span-full"
                />
            </div>}
        </section>)}

        {variants.some(variant => variant.takesPayment) && (ledgerAccounts.length > 0
            ? <SelectNumberPossibleNULL
                label="Konto pengene går til"
                name="ledgerAccountSelection"
                options={[
                    { value: 'NULL', label: 'Velg konto' },
                    ...ledgerAccounts.map(account => ({ value: account.id, label: accountName(account) })),
                ]}
                defaultValue={ledgerAccount?.id ?? 'NULL'}
            />
            : <p className="m-0 text-base-content/80">
                {ledgerAccount
                    ? `Betalingene går til kontoen ${accountName(ledgerAccount)}.`
                    : 'Du har ingen gruppekontoer å knytte arrangementet til.'}
            </p>)}
    </div>
}
